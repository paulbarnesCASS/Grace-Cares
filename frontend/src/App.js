import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import Layout from "@/components/Layout";

import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import PaymentResult from "@/pages/PaymentResult";
import Wishlist from "@/pages/Wishlist";
import DonateFunds from "@/pages/DonateFunds";
import DonateEquipment from "@/pages/DonateEquipment";
import GetHelp from "@/pages/GetHelp";
import NHS from "@/pages/NHS";
import Events from "@/pages/Events";
import EventDetail from "@/pages/EventDetail";
import Resources from "@/pages/Resources";
import Impact from "@/pages/Impact";
import News from "@/pages/News";
import ArticleDetail from "@/pages/ArticleDetail";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import GetInvolved from "@/pages/GetInvolved";
import { Privacy, Terms } from "@/pages/StaticPages";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { ForgotPassword, ResetPassword } from "@/pages/PasswordReset";
import Account from "@/pages/Account";
import Admin from "@/pages/Admin";
import GraceAI from "@/pages/GraceAI";
import NotFound from "@/pages/NotFound";

const withLayout = (el) => <Layout>{el}</Layout>;

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Toaster position="top-center" richColors />
          <Routes>
            <Route path="/" element={withLayout(<Home />)} />
            <Route path="/shop" element={withLayout(<Shop />)} />
            <Route path="/product/:id" element={withLayout(<ProductDetail />)} />
            <Route path="/cart" element={withLayout(<Cart />)} />
            <Route path="/checkout" element={withLayout(<Checkout />)} />
            <Route path="/payment/success" element={withLayout(<PaymentResult />)} />
            <Route path="/payment/cancel" element={withLayout(<PaymentResult />)} />
            <Route path="/wishlist" element={withLayout(<Wishlist />)} />
            <Route path="/donate-funds" element={withLayout(<DonateFunds />)} />
            <Route path="/donate-equipment" element={withLayout(<DonateEquipment />)} />
            <Route path="/get-help" element={withLayout(<GetHelp />)} />
            <Route path="/nhs" element={withLayout(<NHS />)} />
            <Route path="/events" element={withLayout(<Events />)} />
            <Route path="/events/:slug" element={withLayout(<EventDetail />)} />
            <Route path="/resources" element={withLayout(<Resources />)} />
            <Route path="/impact" element={withLayout(<Impact />)} />
            <Route path="/news" element={withLayout(<News />)} />
            <Route path="/news/:slug" element={withLayout(<ArticleDetail />)} />
            <Route path="/about" element={withLayout(<About />)} />
            <Route path="/contact" element={withLayout(<Contact />)} />
            <Route path="/get-involved" element={withLayout(<GetInvolved />)} />
            <Route path="/privacy" element={withLayout(<Privacy />)} />
            <Route path="/terms" element={withLayout(<Terms />)} />
            <Route path="/login" element={withLayout(<Login />)} />
            <Route path="/register" element={withLayout(<Register />)} />
            <Route path="/forgot-password" element={withLayout(<ForgotPassword />)} />
            <Route path="/reset-password" element={withLayout(<ResetPassword />)} />
            <Route path="/account" element={withLayout(<Account />)} />
            <Route path="/grace-ai" element={withLayout(<GraceAI />)} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={withLayout(<NotFound />)} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
