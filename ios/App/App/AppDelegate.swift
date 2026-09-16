import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Force le linker à garder EasyDunyaLocation (chargé via packageClassList).
        // Xcode 15.2 : CAPBridgeViewController.bridge n'est pas visible (pas de sous-classe).
        _ = EasyDunyaLocationPlugin.self
        _ = EasyDunyaNotifyPlugin.self
        window?.backgroundColor = UIColor.systemBackground
        return true
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Xcode 15.2 / Capacitor 8.5 : le proxy n'a pas cette surcharge.
        return true
    }
}
