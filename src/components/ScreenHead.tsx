import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Top of every app screen: a back button and the screen title. */
export function ScreenHead({ back, backLabel, icon, title, children }: {
  back: string
  backLabel: string
  icon?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="screen-head">
      <Link to={back} className="back">
        ← {backLabel}
      </Link>
      <h1>
        {icon && <span aria-hidden="true">{icon} </span>}
        {title}
      </h1>
      {children}
    </div>
  )
}
