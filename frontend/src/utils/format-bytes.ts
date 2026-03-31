const KB = 1024
const MB = 1_048_576
const GB = 1_073_741_824

export function formatBytes(bytes: number) {
  if (bytes < KB) {
    return `${bytes} B`
  }

  if (bytes < MB) {
    const kilobytes = (bytes / KB).toFixed(2)
    return `${kilobytes} KB`
  }

  if (bytes < GB) {
    const megabytes = (bytes / MB).toFixed(2)
    return `${megabytes} MB`
  }

  const gigabytes = (bytes / GB).toFixed(2)
  return `${gigabytes} GB`
}
