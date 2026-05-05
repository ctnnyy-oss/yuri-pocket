// 手机状态栏与圆点装饰：纯静态展示

export function MobileStatusBar() {
  return (
    <div className="mobile-status-bar" aria-hidden="true">
      <b>7:03</b>
      <span className="mobile-signal">5G 5G ▰▰▰ 37</span>
    </div>
  )
}

export function GridDots() {
  return (
    <span className="grid-dots" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}
