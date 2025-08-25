import React from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Contact from "./pages/Contact";
import TrackingPage from "./pages/TrackingPage";
import Footer from "./components/Footer";

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
        </Routes>
      </main>

      {/* Footer can be added later if needed */}
      <Footer />
    </div>
  );
};

export default App;
