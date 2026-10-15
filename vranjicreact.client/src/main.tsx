import './index.css';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Home from './pages/Home';
import Onama from './pages/Onama';
import NotFound from './pages/NotFound';
import Kontakt from './pages/Kontakt';
import Galerija from './pages/Galerija';
import GalerijaAlbum from './pages/GalerijaAlbum';
import Blog from './pages/Blog';
import BlogDetalj from './pages/BlogDetalj';
import Novosti from './pages/Novosti';
import Aktualno from './pages/Aktualno';
import PortalUpdates from './pages/portal/PortalUpdates';
import NovostDetalj from './pages/NovostDetalj';
import Login from './pages/Login';
import Uloge from './pages/Uloge';
import PortalStoryReview from './pages/portal/PortalStoryReview';
import { LazyAcceptInvitation as AcceptInvitation, LazyUserForm as PortalUserForm } from './pages/LazyAccountPages';
import ProtectedRoute from './components/common/ProtectedRoute';
import PortalLayout from './pages/portal/PortalLayout';
import PortalDashboard from './pages/portal/PortalDashboard';
import PortalNewsList from './pages/portal/PortalNewsList';
import PortalNewsForm from './pages/portal/PortalNewsForm';
import PortalGalleryList from './pages/portal/PortalGalleryList';
import PortalGalleryForm from './pages/portal/PortalGalleryForm';
import PortalGalleryAlbumForm from './pages/portal/PortalGalleryAlbumForm';
import PortalGalleryAlbumDetail from './pages/portal/PortalGalleryAlbumDetail';
import PortalUsersList from './pages/portal/PortalUsersList';
import PortalUserEditForm from './pages/portal/PortalUserEditForm';
import PortalContactMessages from './pages/portal/PortalContactMessages';
import PortalChangePassword from './pages/portal/PortalChangePassword';
import NaseMaloMisto from './pages/NaseMaloMisto';
import Podrucje from './pages/Podrucje';
import AreaContribution from './pages/AreaContribution';
import PortalClassification from './pages/portal/PortalClassification';
import Obavijesti from './pages/Obavijesti';
import ObavijestDetalj from './pages/ObavijestDetalj';
import PortalAnnouncementsList from './pages/portal/PortalAnnouncementsList';
import PortalAnnouncementForm from './pages/portal/PortalAnnouncementForm';
import PortalBlogList from './pages/portal/PortalBlogList';
import PortalBlogForm from './pages/portal/PortalBlogForm';
import PortalModerationQueue from './pages/portal/PortalModerationQueue';
import PortalModeratorAssignments from './pages/portal/PortalModeratorAssignments';
import { CONTENT_VERIFY_ROLES, CONTENT_CREATE_ROLES, CONTENT_MANAGE_ROLES, CONTENT_MODERATE_ROLES, SUPERUSER_ONLY_ROLES, USER_MANAGE_ROLES } from './lib/auth-roles';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <LanguageProvider>
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<App />}>
                        <Route index element={<Home />} />
                        <Route path="onama" element={<Onama />} />
                        <Route path="kontakt" element={<Kontakt />} />
                        <Route path="uloge" element={<ProtectedRoute requiredRoles={[]}><Uloge /></ProtectedRoute>} />
                        <Route path="galerija" element={<Galerija />} />
                        <Route path="galerija/:albumId" element={<GalerijaAlbum />} />
                        <Route path="blog" element={<Blog />} />
                        <Route path="blog/:slug" element={<BlogDetalj />} />
                        <Route path="novosti" element={<Novosti />} />
                        <Route path="aktualno" element={<Aktualno />} />
                        <Route path="novosti/:slug" element={<NovostDetalj />} />
                        <Route path="obavijesti" element={<Obavijesti />} />
                        <Route path="obavijesti/:slug" element={<ObavijestDetalj />} />
                        <Route path="nase-malo-misto" element={<NaseMaloMisto />} />
                        <Route path="nase-malo-misto/:slug" element={<Podrucje />} />
                        <Route path="nase-malo-misto/:slug/dodaj/:kind?/:contentId?" element={<ProtectedRoute requiredRoles={CONTENT_CREATE_ROLES}><AreaContribution /></ProtectedRoute>} />
                        <Route path="dodaj/:kind/:contentId?" element={<ProtectedRoute requiredRoles={CONTENT_CREATE_ROLES}><AreaContribution /></ProtectedRoute>} />
                        <Route path="login" element={<Login />} />
                        <Route path="prihvati-pozivnicu" element={<AcceptInvitation />} />
                        <Route
                            path="portal"
                            element={
                                <ProtectedRoute>
                                    <PortalLayout />
                                </ProtectedRoute>
                            }
                        >
                            <Route index element={<PortalDashboard />} />
                            <Route path="news" element={<PortalNewsList />} />
                            <Route path="updates" element={<ProtectedRoute requiredRoles={CONTENT_CREATE_ROLES}><PortalUpdates /></ProtectedRoute>} />
                            <Route path="announcements" element={<PortalAnnouncementsList />} />
                            <Route path="blog" element={<PortalBlogList />} />
                            <Route path="blog/:id/review" element={<ProtectedRoute requiredRoles={CONTENT_VERIFY_ROLES} redirectTo="/portal/blog"><PortalStoryReview /></ProtectedRoute>} />
                            <Route
                                path="blog/new"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_CREATE_ROLES} redirectTo="/portal/blog">
                                        <PortalBlogForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="blog/:id/edit"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_CREATE_ROLES} redirectTo="/portal/blog">
                                        <PortalBlogForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="announcements/new"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_CREATE_ROLES} redirectTo="/portal/announcements">
                                        <PortalAnnouncementForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="announcements/:id/edit"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_CREATE_ROLES} redirectTo="/portal/announcements">
                                        <PortalAnnouncementForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="news/new"
                                element={
                                    <ProtectedRoute
                                        requiredRoles={CONTENT_CREATE_ROLES}
                                        redirectTo="/portal/news"
                                    >
                                        <PortalNewsForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="news/:id/edit"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_CREATE_ROLES} redirectTo="/portal/news">
                                        <PortalNewsForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route path="gallery" element={<PortalGalleryList />} />
                            <Route
                                path="gallery/new"
                                element={
                                    <ProtectedRoute
                                        requiredRoles={CONTENT_CREATE_ROLES}
                                        redirectTo="/portal/gallery"
                                    >
                                        <PortalGalleryForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="gallery/albums/new"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_CREATE_ROLES} redirectTo="/portal/gallery">
                                        <PortalGalleryAlbumForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="gallery/albums/:albumId/edit"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_CREATE_ROLES} redirectTo="/portal/gallery">
                                        <PortalGalleryAlbumForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route path="gallery/:albumId" element={<PortalGalleryAlbumDetail />} />
                            <Route
                                path="gallery/items/:itemId/edit"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_CREATE_ROLES} redirectTo="/portal/gallery">
                                        <PortalGalleryForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="users"
                                element={
                                    <ProtectedRoute requiredRoles={USER_MANAGE_ROLES} redirectTo="/portal">
                                        <PortalUsersList />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="users/new"
                                element={
                                    <ProtectedRoute requiredRoles={USER_MANAGE_ROLES} redirectTo="/portal">
                                        <PortalUserForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="users/:id/edit"
                                element={
                                    <ProtectedRoute requiredRoles={SUPERUSER_ONLY_ROLES} redirectTo="/portal/users">
                                        <PortalUserEditForm />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="contacts"
                                element={
                                    <ProtectedRoute requiredRoles={USER_MANAGE_ROLES} redirectTo="/portal">
                                        <PortalContactMessages />
                                    </ProtectedRoute>
                                }
                            />
                            <Route path="password" element={<PortalChangePassword />} />
                            <Route path="classification" element={<Navigate to="/portal/areas" replace />} />
                            <Route
                                path="areas"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_MANAGE_ROLES} redirectTo="/portal">
                                        <PortalClassification key="areas" section="areas" />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="tags"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_MANAGE_ROLES} redirectTo="/portal">
                                        <PortalClassification key="tags" section="tags" />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="moderation"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_MODERATE_ROLES} redirectTo="/portal">
                                        <PortalModerationQueue />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="moderator-assignments"
                                element={
                                    <ProtectedRoute requiredRoles={CONTENT_MANAGE_ROLES} redirectTo="/portal">
                                        <PortalModeratorAssignments />
                                    </ProtectedRoute>
                                }
                            />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    </LanguageProvider>
);
