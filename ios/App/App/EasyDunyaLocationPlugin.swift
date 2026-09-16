import Foundation
import CoreLocation
import UIKit
import Capacitor

/// Localisation iOS sans @capacitor/geolocation (Xcode 15.2 : pas de CAPPluginCall.reject).
@objc(EasyDunyaLocationPlugin)
public class EasyDunyaLocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "EasyDunyaLocationPlugin"
    public let jsName = "EasyDunyaLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCurrentPosition", returnType: CAPPluginReturnPromise)
    ]

    private var manager: CLLocationManager?
    private var permissionCall: CAPPluginCall?
    private var positionCall: CAPPluginCall?
    private var positionTimer: Timer?

    public override func load() {
        onMain {
            self.ensureManager()
        }
    }

    private func ensureManager() {
        if manager != nil { return }
        let mgr = CLLocationManager()
        mgr.delegate = self
        mgr.desiredAccuracy = kCLLocationAccuracyHundredMeters
        mgr.distanceFilter = kCLDistanceFilterNone
        mgr.pausesLocationUpdatesAutomatically = false
        manager = mgr
    }

    private func onMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }

    private func authStatus() -> CLAuthorizationStatus {
        ensureManager()
        return manager?.authorizationStatus ?? .notDetermined
    }

    private func statusString(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .authorizedAlways, .authorizedWhenInUse:
            return "granted"
        case .denied, .restricted:
            return "denied"
        default:
            return "prompt"
        }
    }

    private func failPosition(_ call: CAPPluginCall, _ message: String) {
        call.resolve(["ok": false, "error": message])
    }

    @objc func isEnabled(_ call: CAPPluginCall) {
        onMain {
            call.resolve(["enabled": CLLocationManager.locationServicesEnabled()])
        }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        openAppSettingsUrl()
        call.resolve()
    }

    @objc func openAppSettings(_ call: CAPPluginCall) {
        openAppSettingsUrl()
        call.resolve()
    }

    @objc func checkPermission(_ call: CAPPluginCall) {
        onMain {
            if !CLLocationManager.locationServicesEnabled() {
                call.resolve(["status": "prompt", "enabled": false])
                return
            }
            call.resolve([
                "status": self.statusString(self.authStatus()),
                "enabled": true
            ])
        }
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        onMain {
            self.ensureManager()
            if !CLLocationManager.locationServicesEnabled() {
                call.resolve(["status": "denied", "enabled": false])
                return
            }
            let status = self.authStatus()
            if status == .authorizedAlways || status == .authorizedWhenInUse {
                call.resolve(["status": "granted", "enabled": true])
                return
            }
            if status == .denied || status == .restricted {
                call.resolve(["status": "denied", "enabled": true])
                return
            }
            self.permissionCall = call
            self.manager?.requestWhenInUseAuthorization()
        }
    }

    @objc func getCurrentPosition(_ call: CAPPluginCall) {
        onMain {
            self.ensureManager()
            if !CLLocationManager.locationServicesEnabled() {
                self.failPosition(call, "Location services disabled")
                return
            }
            let status = self.authStatus()
            if status == .denied || status == .restricted {
                self.failPosition(call, "Geolocation permission denied")
                return
            }

            let highAccuracy = call.getBool("enableHighAccuracy", false)
            self.manager?.desiredAccuracy = highAccuracy
                ? kCLLocationAccuracyBest
                : kCLLocationAccuracyHundredMeters

            self.stopUpdates()
            self.positionCall = call
            self.startPositionTimeout(20)

            if status == .notDetermined {
                self.permissionCall = nil
                self.manager?.requestWhenInUseAuthorization()
                return
            }
            self.manager?.startUpdatingLocation()
        }
    }

    private func startPositionTimeout(_ seconds: TimeInterval) {
        positionTimer?.invalidate()
        let timer = Timer(timeInterval: max(8, seconds), repeats: false) { [weak self] _ in
            guard let strong = self, let call = strong.positionCall else { return }
            strong.positionCall = nil
            strong.stopUpdates()
            strong.failPosition(call, "Location timeout")
        }
        RunLoop.main.add(timer, forMode: .common)
        positionTimer = timer
    }

    private func stopUpdates() {
        positionTimer?.invalidate()
        positionTimer = nil
        manager?.stopUpdatingLocation()
    }

    private func openAppSettingsUrl() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            return
        }
        onMain {
            UIApplication.shared.open(url)
        }
    }

    private func handleAuthChange() {
        let status = authStatus()
        let granted = status == .authorizedAlways || status == .authorizedWhenInUse

        if let call = permissionCall {
            permissionCall = nil
            call.resolve(["status": statusString(status), "enabled": true])
        }

        if let _ = positionCall {
            if granted {
                manager?.startUpdatingLocation()
            } else if status == .denied || status == .restricted {
                if let call = positionCall {
                    positionCall = nil
                    stopUpdates()
                    failPosition(call, "Geolocation permission denied")
                }
            }
        }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        onMain {
            self.handleAuthChange()
        }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        onMain {
            guard let loc = locations.last, let call = self.positionCall else { return }
            if loc.horizontalAccuracy < 0 { return }
            self.positionCall = nil
            self.stopUpdates()
            call.resolve([
                "ok": true,
                "latitude": loc.coordinate.latitude,
                "longitude": loc.coordinate.longitude,
                "accuracy": loc.horizontalAccuracy,
                "timestamp": loc.timestamp.timeIntervalSince1970 * 1000
            ])
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        onMain {
            let ns = error as NSError
            // Première fix GPS : iOS envoie souvent locationUnknown. On attend le timeout.
            if ns.domain == kCLErrorDomain, ns.code == CLError.locationUnknown.rawValue {
                return
            }
            guard let call = self.positionCall else { return }
            self.positionCall = nil
            self.stopUpdates()
            if ns.domain == kCLErrorDomain, ns.code == CLError.denied.rawValue {
                self.failPosition(call, "Geolocation permission denied")
                return
            }
            self.failPosition(call, error.localizedDescription)
        }
    }
}
