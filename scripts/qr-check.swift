// Проверка QR-кодов src/qr.js распознавателем macOS (Core Image): swift scripts/qr-check.swift картинка.png …
// Печатает для каждой картинки распознанный текст или «НЕ РАСПОЗНАН». Нужен только для проверки при разработке.
import Foundation
import CoreImage
let detector = CIDetector(ofType: CIDetectorTypeQRCode, context: nil, options: [CIDetectorAccuracy: CIDetectorAccuracyHigh])!
var bad = 0
for p in CommandLine.arguments.dropFirst() {
  guard let img = CIImage(contentsOf: URL(fileURLWithPath: p)) else { print("\(p): нет картинки"); bad += 1; continue }
  let found = detector.features(in: img).compactMap { ($0 as? CIQRCodeFeature)?.messageString }
  if found.isEmpty { print("\(p): НЕ РАСПОЗНАН"); bad += 1 } else { print("\(p): \(found.joined(separator: " | "))") }
}
exit(bad == 0 ? 0 : 1)
