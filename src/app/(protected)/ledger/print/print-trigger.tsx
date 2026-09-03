'use client'

// Print/Close buttons — event handlers can't be passed from the Server
// Component page.tsx, so they live here instead. No auto-print on load —
// that used to black out the page as soon as it opened; the user clicks
// "Print / Save as PDF" manually.
export function PrintTrigger() {
  return (
    <div className="print:hidden flex gap-3 mb-6">
      <button
        onClick={() => window.print()}
        className="px-4 py-2 bg-black text-white text-sm rounded-md hover:bg-neutral-800"
      >
        🖨 Print / Save as PDF
      </button>
      <button
        onClick={() => window.close()}
        className="px-4 py-2 border border-neutral-300 text-sm rounded-md hover:bg-neutral-50"
      >
        ✕ Close
      </button>
    </div>
  )
}
