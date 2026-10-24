(function () {
  var el = document.getElementById('dsh-boot-splash')
  if (!el) return
  try {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // 标题在 1920ms 完整出现；再停 1000ms 收场（弱动效模式下直接给最终画面）
    var min = reduce ? 1000 : 2920
    var fade = 350
    var started = performance.now()
    var gone = false

    function clear () {
      if (gone) return
      gone = true
      try {
        el.style.transition = 'opacity ' + fade + 'ms ease'
        el.style.opacity = '0'
        el.style.pointerEvents = 'none'
      } catch (_) {}
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el)
      }, fade + 80)
    }

    function ready () {
      var root = document.getElementById('root')
      return !!root && root.childElementCount > 0
    }

    function tick () {
      if (gone) return
      var t = performance.now() - started
      // 到点就收；万一界面还没挂载，最多再等 1.2s
      if (t >= min && (ready() || t >= min + 1200)) { clear(); return }
      requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    el.addEventListener('click', clear, true)
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') clear()
    }, true)
    // 兜底：即使应用一直没挂载，也不能挡住界面
    setTimeout(function () { if (!gone) clear() }, min + 2400)
  } catch (_) {
    // 开屏出错绝不能挡住应用
    try { el.parentNode.removeChild(el) } catch (_) {}
  }
})()
