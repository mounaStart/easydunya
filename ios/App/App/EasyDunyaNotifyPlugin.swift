import Foundation
import UserNotifications
import Capacitor

/// Notifications locales iOS (pas d'APNs / pas de capacité Push — Personal Team OK).
@objc(EasyDunyaNotifyPlugin)
public class EasyDunyaNotifyPlugin: CAPPlugin, CAPBridgedPlugin, UNUserNotificationCenterDelegate {
    public let identifier = "EasyDunyaNotifyPlugin"
    public let jsName = "EasyDunyaNotify"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise)
    ]

    public override func load() {
        DispatchQueue.main.async {
            UNUserNotificationCenter.current().delegate = self
        }
    }

    private func statusString(_ settings: UNNotificationSettings) -> String {
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return "granted"
        case .denied:
            return "denied"
        default:
            return "prompt"
        }
    }

    @objc func checkPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                call.resolve(["status": self.statusString(settings)])
            }
        }
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                DispatchQueue.main.async {
                    call.resolve(["status": self.statusString(settings)])
                }
            }
        }
    }

    @objc func show(_ call: CAPPluginCall) {
        let title = call.getString("title", "Easy Dunya")
        let body = call.getString("body", "")
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.15, repeats: false)
        let req = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: trigger
        )
        UNUserNotificationCenter.current().add(req) { error in
            DispatchQueue.main.async {
                if error != nil {
                    call.resolve(["ok": false])
                } else {
                    call.resolve(["ok": true])
                }
            }
        }
    }

    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .sound, .badge])
        } else {
            completionHandler([.alert, .sound, .badge])
        }
    }
}
