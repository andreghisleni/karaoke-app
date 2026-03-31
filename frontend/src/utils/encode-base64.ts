export function encodeBase64(str: string) {
  return btoa(
    // biome-ignore lint/complexity/useArrowFunction: test
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_, p1) {
      return String.fromCharCode(Number.parseInt(p1, 16))
    }),
  )
}
