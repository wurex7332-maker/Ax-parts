import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** 每个页面设置 document.title（导航可感知） */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title}｜车间辅料管理平台` : '车间辅料管理平台';
  }, [title]);
}

/** 路由切换后把焦点移到 h1，便于键盘与读屏用户定位（AC-8） */
export function FocusOnRouteChange(): null {
  const location = useLocation();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const heading = document.querySelector<HTMLElement>('main h1');
      heading?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  return null;
}
