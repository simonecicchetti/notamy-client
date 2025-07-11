import UIKit
import ExpoModulesCore

@UIApplicationMain
class AppDelegate: EXAppDelegateWrapper {
    override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }

    override func sourceURL(for bridge: RCTBridge) -> URL? {
        return self.bundleURL()
    }

    func bundleURL() -> URL? {
#if DEBUG
        return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
        return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
    }
}