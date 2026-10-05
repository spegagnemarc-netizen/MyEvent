import SwiftUI
import WebKit
import SafariServices

struct MyEventWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        let coordinator = context.coordinator
        config.userContentController.addScriptMessageHandler(coordinator, contentWorld: .page, name: "myeventCamera")
        if let path = Bundle.main.url(forResource: "native-camera", withExtension: "js"),
           let script = try? String(contentsOf: path, encoding: .utf8) {
            config.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        let web = WKWebView(frame: .zero, configuration: config)
        coordinator.web = web
        web.navigationDelegate = coordinator
        web.uiDelegate = coordinator
        // A TEST-only build configuration, no production fallback or bundled Supabase keys.
        if let raw = Bundle.main.object(forInfoDictionaryKey: "MyEventWebURL") as? String,
           let url = URL(string: raw), url.scheme == "https", url.user == nil, url.password == nil {
            coordinator.origin = url.host
            web.load(URLRequest(url: url))
        }
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        coordinator.cancelPending("Écran fermé.")
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "myeventCamera", contentWorld: .page)
        uiView.stopLoading()
    }

    @MainActor final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply {
        weak var web: WKWebView?
        var origin: String?
        private var pending: ((Any?, String?) -> Void)?
        private var camera: UIViewController?

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
            guard message.frameInfo.isMainFrame,
                  message.frameInfo.securityOrigin.protocol == "https",
                  message.frameInfo.securityOrigin.host == origin,
                  message.frameInfo.securityOrigin.port == 0 || message.frameInfo.securityOrigin.port == 443,
                  web?.url?.host == origin,
                  let body = message.body as? [String: Any],
                  body.count == 2, body["version"] as? Int == 1, body["action"] as? String == "capturePhoto" else {
                replyHandler(nil, "Requête native refusée."); return
            }
            guard pending == nil, let root = web?.window?.rootViewController else { replyHandler(nil, "Caméra indisponible."); return }
            pending = replyHandler
            let sheet = UIHostingController(rootView: CameraView { [weak self] data in
                guard let self else { return }
                self.camera?.dismiss(animated: true)
                self.camera = nil
                let callback = self.pending; self.pending = nil
                if let data { callback?(["version": 1, "mime": "image/jpeg", "base64": data.base64EncodedString()], nil) }
                else { callback?(["version": 1, "cancelled": true], nil) }
            })
            sheet.modalPresentationStyle = .fullScreen
            camera = sheet
            root.present(sheet, animated: true)
        }
        func cancelPending(_ reason: String) {
            let callback = pending; pending = nil
            camera?.dismiss(animated: false); camera = nil
            callback?(nil, reason)
        }
        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { cancelPending("Navigation en cours.") }
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            guard navigationAction.targetFrame == nil, let url = navigationAction.request.url,
                  url.user == nil, url.password == nil else { return nil }
            if url.scheme == "https", url.host == origin, url.port == nil || url.port == 443 {
                webView.load(URLRequest(url: url))
            } else if url.scheme == "https" || url.scheme == "http" {
                webView.window?.rootViewController?.present(SFSafariViewController(url: url), animated: true)
            }
            return nil
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            if navigationAction.targetFrame?.isMainFrame == false {
                decisionHandler(url.scheme == "https" ? .allow : .cancel); return
            }
            if url.scheme == "https", url.host == origin, url.user == nil, url.password == nil, url.port == nil || url.port == 443 {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
                if url.scheme == "https" || url.scheme == "http" {
                    let safari = SFSafariViewController(url: url)
                    webView.window?.rootViewController?.present(safari, animated: true)
                }
            }
        }
    }
}
