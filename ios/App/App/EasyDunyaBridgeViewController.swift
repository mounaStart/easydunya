import UIKit
import Capacitor

/// Enregistre le plugin GPS local (équivalent de `registerPlugin` dans MainActivity Android).
/// Sans ça, Capacitor 8 ne charge que `packageClassList` : EasyDunyaLocation n'existe pas pour le JS.
@objc(EasyDunyaBridgeViewController)
class EasyDunyaBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(EasyDunyaLocationPlugin())
    }
}
