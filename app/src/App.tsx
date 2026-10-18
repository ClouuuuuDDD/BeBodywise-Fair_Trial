import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { allScreenRoutes, shellRoutes } from './routes';
import { RootLayout } from './ui/RootLayout';

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [...allScreenRoutes, ...shellRoutes],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
