# Scroll & Stitch Canvas Capture

We chose client-side scroll-and-stitch via HTML5 Canvas over Chrome DevTools Protocol (CDP) `Page.captureScreenshot`.

While CDP can capture full-page height in a single native call, it requires the `debugger` permission which permanently displays an invasive security banner ("quick-screen is debugging this browser") at the top of the browser viewport. Scroll-and-stitch provides a non-invasive, warning-free user experience while handling fixed headers cleanly.
