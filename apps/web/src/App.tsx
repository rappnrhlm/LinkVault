import { Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { UiProvider } from './lib/ui';
import Overview from './pages/Overview';
import ItemsPage from './pages/ItemsPage';
import ItemDetailPage from './pages/ItemDetail';
import CollectionsPage from './pages/CollectionsPage';
import CollectionDetail from './pages/CollectionDetail';
import TagsPage from './pages/TagsPage';
import DataPage from './pages/DataPage';
import { EmptyState } from './components/States';

export default function App() {
  return (
    <UiProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="items" element={<ItemsPage view="all" />} />
          <Route path="bookmarks" element={<ItemsPage view="bookmarks" />} />
          <Route path="notes" element={<ItemsPage view="notes" />} />
          <Route path="favorites" element={<ItemsPage view="favorites" />} />
          <Route path="archive" element={<ItemsPage view="archive" />} />
          <Route path="trash" element={<ItemsPage view="trash" />} />
          <Route path="items/:id" element={<ItemDetailPage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="collections/:id" element={<CollectionDetail />} />
          <Route path="tags" element={<TagsPage />} />
          <Route path="data" element={<DataPage />} />
          <Route
            path="*"
            element={
              <div className="page">
                <EmptyState title="This page is not on the shelf">
                  The address does not match a screen in LinkVault.
                </EmptyState>
              </div>
            }
          />
        </Route>
      </Routes>
    </UiProvider>
  );
}
