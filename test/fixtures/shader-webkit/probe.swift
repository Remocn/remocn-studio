import AppKit
import WebKit
final class Handler: NSObject, WKScriptMessageHandler {
  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    print(message.body)
    exit((message.body as? String)?.contains("\"ok\":true") == true ? 0 : 1)
  }
}
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let configuration = WKWebViewConfiguration()
configuration.websiteDataStore = .nonPersistent()
let handler = Handler()
configuration.userContentController.add(handler, name: "result")
let view = WKWebView(frame: NSRect(x: 0, y: 0, width: 320, height: 540), configuration: configuration)
let window = NSWindow(contentRect: view.frame, styleMask: [.borderless], backing: .buffered, defer: false)
window.contentView = view
window.orderFront(nil)
let url = URL(fileURLWithPath: CommandLine.arguments[1])
view.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
DispatchQueue.main.asyncAfter(deadline: .now() + 20) { print("WebKit probe timed out"); exit(2) }
app.run()
