import React from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import Home from "./Pages/Home";
import Contact from "./Pages/Contact";
import TrackingPage from "./Pages/TrackingPage";
import Footer from "./components/Footer";
import AdminPage from "./Pages/AdminPage";

const App = () => {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Toast notifications */}
      <Toaster position="top-center" toastOptions={{ duration: 4000 }} />

      {/* Navbar */}
      <Navbar />

      {/* Main content */}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/track/:id" element={<TrackingPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>

      {/* Footer can be added later if needed */}
      <Footer />
    </div>
  );
};

export default App;
