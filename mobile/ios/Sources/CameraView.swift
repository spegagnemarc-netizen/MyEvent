import SwiftUI
import PhotosUI
import Photos

struct CameraView: View {
    @StateObject private var engine = CameraEngine()
    @Environment(\.scenePhase) private var scenePhase
    @State private var captured: UIImage?
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var filter: CameraFilter = .original
    @State private var ratio: CGFloat = 3/4
    @State private var zoom: CGFloat = 1
    @State private var grid = false
    @State private var level = false
    @State private var timer = 0
    @State private var countdown = 0
    @State private var countdownTask: Task<Void, Never>?
    @State private var status = ""
    let finish: (Data?) -> Void

    var body: some View {
        VStack(spacing: 12) {
            HStack { Button("Fermer") { finish(nil) }; Spacer(); Text("MyEvent").bold(); Spacer(); Button("↻") { engine.flip(); zoom = 1 }.disabled(captured != nil) }
            ZStack {
                Color.black
                if let image = captured ?? engine.frame { Image(uiImage: image).resizable().scaledToFit() }
                if grid && captured == nil {
                    GeometryReader { g in
                        Path { p in
                            for part in [CGFloat(1)/3, CGFloat(2)/3] {
                                p.move(to: CGPoint(x: g.size.width*part, y: 0)); p.addLine(to: CGPoint(x: g.size.width*part, y: g.size.height))
                                p.move(to: CGPoint(x: 0, y: g.size.height*part)); p.addLine(to: CGPoint(x: g.size.width, y: g.size.height*part))
                            }
                        }.stroke(.white.opacity(0.5))
                    }
                }
                if level && captured == nil { Rectangle().fill(abs(engine.roll)<0.04 ? .green : .white).frame(width: 90, height: 2).rotationEffect(.radians(-engine.roll)) }
                if countdown > 0 { Text("\(countdown)").font(.largeTitle).foregroundStyle(.white) }
            }.aspectRatio(ratio, contentMode: .fit)
                .gesture(MagnifyGesture().onChanged { value in if captured == nil { engine.zoom(zoom * value.magnification) } }.onEnded { value in zoom = max(1,min(4,zoom*value.magnification)) })
            if let error = engine.error { Text(error).font(.caption).accessibilityLabel(error) }
            if !status.isEmpty { Text(status).font(.caption) }
            if let image = captured {
                HStack {
                    Button("Reprendre") { captured = nil; engine.start() }
                    Button("Photos") { save(image) }
                    Button("Continuer dans MyEvent") {
                        guard let data = image.jpegData(compressionQuality: 0.85), data.count <= 4*1024*1024 else { status = "Photo trop volumineuse pour le transfert (4 Mo)."; return }
                        finish(data)
                    }
                }
            } else {
                ScrollView(.horizontal) { HStack { ForEach(CameraFilter.allCases) { item in Button(item.label) { filter = item; engine.set(filter: item, ratio: ratio) }.buttonStyle(.bordered).tint(filter == item ? .orange : .gray) } } }
                HStack {
                    Toggle("Grille", isOn: $grid); Toggle("Niveau", isOn: $level)
                }.font(.caption)
                HStack {
                    Picker("Ratio", selection: $ratio) { Text("4:3").tag(CGFloat(3)/4); Text("Carré").tag(CGFloat(1)); Text("9:16").tag(CGFloat(9)/16) }
                    Picker("Timer", selection: $timer) { Text("Sans timer").tag(0); Text("3 s").tag(3); Text("10 s").tag(10) }
                }.onChange(of: ratio) { _, value in engine.set(filter: filter, ratio: value) }
                HStack {
                    PhotosPicker(selection: $selectedPhoto, matching: .images) { Label("Galerie", systemImage: "photo") }
                    Spacer()
                    Button(action: shutter) {
                        if let logo = UIImage(named: "camera-me-logo.jpeg") {
                            Image(uiImage: logo).resizable().scaledToFill().frame(width: 70, height: 70).clipShape(Circle())
                        } else { Text("ME").font(.title.bold()).frame(width: 70, height: 70).background(.orange, in: Circle()).foregroundStyle(.black) }
                    }.accessibilityLabel("Prendre une photo MyEvent").disabled(engine.frame == nil || countdown > 0)
                    Spacer(); Text(String(format: "%.1f×", zoom))
                }
            }
        }.padding().background(Color.black).foregroundStyle(.white)
            .onAppear { engine.start() }
            .onDisappear { countdownTask?.cancel(); engine.stop() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active && captured == nil { engine.start() }
                else { countdownTask?.cancel(); countdown = 0; engine.stop() }
            }
            .onChange(of: selectedPhoto) { _, item in
                countdownTask?.cancel(); countdown = 0
                Task {
                    guard let data = try? await item?.loadTransferable(type: Data.self), data.count <= 20*1024*1024,
                          let image = UIImage(data: data) else { status = "Photo importée indisponible ou trop volumineuse."; return }
                    // Imported image retains its orientation. Native live filters are not silently applied to imports.
                    captured = image; engine.stop()
                }
            }
    }
    private func shutter() {
        countdownTask = Task { @MainActor in
            for remaining in stride(from: timer, through: 1, by: -1) {
                countdown = remaining
                do { try await Task.sleep(for: .seconds(1)) } catch { countdown = 0; return }
            }
            countdown = 0
            guard !Task.isCancelled, let frame = engine.frame else { return }
            captured = frame; engine.stop()
        }
    }
    private func save(_ image: UIImage) {
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { permission in
            guard permission == .authorized || permission == .limited else {
                DispatchQueue.main.async { status = "Autorisez l’ajout aux Photos dans Réglages." }; return
            }
            PHPhotoLibrary.shared().performChanges({ PHAssetChangeRequest.creationRequestForAsset(from: image) }) { success, _ in
                DispatchQueue.main.async { status = success ? "Photo enregistrée." : "Enregistrement impossible." }
            }
        }
    }
}
