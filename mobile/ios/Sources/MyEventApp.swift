import SwiftUI

@main
struct MyEventApp: App {
    var body: some Scene { WindowGroup { MyEventWebView().ignoresSafeArea(edges: .bottom) } }
}
