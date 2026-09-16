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

    private let manager = CLLocationManager()
    private var permissionCall: CAPPluginCall?
    private var positionCall: CAPPluginCall?
    private var positionTimer: Timer?

    public override func load() {
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    private func authStatus() -> CLAuthorizationStatus {
        return manager.authorizationStatus
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
        call.resolve(["enabled": CLLocationManager.locationServicesEnabled()])
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
        if !CLLocationManager.locationServicesEnabled() {
            call.resolve(["status": "prompt", "enabled": false])
            return
        }
        call.resolve([
            "status": statusString(authStatus()),
            "enabled": true
        ])
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        if !CLLocationManager.locationServicesEnabled() {
            call.resolve(["status": "denied", "enabled": false])
            return
        }
        let status = authStatus()
        if status == .authorizedAlways || status == .authorizedWhenInUse {
            call.resolve(["status": "granted", "enabled": true])
            return
        }
        if status == .denied || status == .restricted {
            call.resolve(["status": "denied", "enabled": true])
            return
        }
        permissionCall = call
        DispatchQueue.main.async {
            self.manager.requestWhenInUseAuthorization()
        }
    }

    @objc func getCurrentPosition(_ call: CAPPluginCall) {
        if !CLLocationManager.locationServicesEnabled() {
            failPosition(call, "Location services disabled")
            return
        }
        let status = authStatus()
        if status == .denied || status == .restricted {
            failPosition(call, "Geolocation permission denied")
            return
        }

        let highAccuracy = call.getBool("enableHighAccuracy", false)
        manager.desiredAccuracy = highAccuracy
            ? kCLLocationAccuracyBest
            : kCLLocationAccuracyHundredMeters

        positionCall = call
        let timeoutSec = (call.getDouble("timeout", 20000) ?? 20000) / 1000.0
        startPositionTimeout(timeoutSec)

        if status == .notDetermined {
            permissionCall = nil
            DispatchQueue.main.async {
                self.manager.requestWhenInUseAuthorization()
            }
            return
        }
        DispatchQueue.main.async {
            self.manager.requestLocation()
        }
    }

    private func startPositionTimeout(_ seconds: TimeInterval) {
        positionTimer?.invalidate()
        positionTimer = Timer.scheduledTimer(withTimeInterval: max(5, seconds), repeats: false) { [weak self] _ in
            guard let strong = self, let call = strong.positionCall else { return }
            strong.positionCall = nil
            strong.failPosition(call, "Location timeout")
        }
    }

    private func clearPositionWait() {
        positionTimer?.invalidate()
        positionTimer = nil
    }

    private func openAppSettingsUrl() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            return
        }
        DispatchQueue.main.async {
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

        if let call = positionCall {
            if granted {
                DispatchQueue.main.async {
                    self.manager.requestLocation()
                }
            } else if status == .denied || status == .restricted {
                positionCall = nil
                clearPositionWait()
                failPosition(call, "Geolocation permission denied")
            }
        }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        handleAuthChange()
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let loc = locations.last, let call = positionCall else { return }
        positionCall = nil
        clearPositionWait()
        call.resolve([
            "ok": true,
            "latitude": loc.coordinate.latitude,
            "longitude": loc.coordinate.longitude,
            "accuracy": loc.horizontalAccuracy,
            "timestamp": loc.timestamp.timeIntervalSince1970 * 1000
        ])
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard let call = positionCall else { return }
        positionCall = nil
        clearPositionWait()
        let ns = error as NSError
        if ns.domain == kCLErrorDomain, ns.code == CLError.denied.rawValue {
            failPosition(call, "Geolocation permission denied")
            return
        }
        failPosition(call, error.localizedDescription)
    }
}
