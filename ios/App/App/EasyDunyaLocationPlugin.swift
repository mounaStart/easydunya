import Foundation
import CoreLocation
import UIKit
import Capacitor

@objc(EasyDunyaLocationPlugin)
public class EasyDunyaLocationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EasyDunyaLocationPlugin"
    public let jsName = "EasyDunyaLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppSettings", returnType: CAPPluginReturnPromise)
    ]

    @objc func isEnabled(_ call: CAPPluginCall) {
        call.resolve([
            "enabled": CLLocationManager.locationServicesEnabled()
        ])
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        openAppSettingsUrl()
        call.resolve()
    }

    @objc func openAppSettings(_ call: CAPPluginCall) {
        openAppSettingsUrl()
        call.resolve()
    }

    private func openAppSettingsUrl() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url)
        }
    }
}
