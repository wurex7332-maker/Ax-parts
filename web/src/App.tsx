import { HashRouter } from 'react-router-dom';
import { Announcer } from './components/a11y/Announcer';
import { ToastHost } from './components/ui/ToastHost';
import { AppRoutes } from './routes/router';

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
      <ToastHost />
      <Announcer />
    </HashRouter>
  );
}
