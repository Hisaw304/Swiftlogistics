// src/components/HeroSection.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import heroImage from "../assets/hero-bg.jpeg"; // your hero background image

const HeroSection = () => {
  const [trackingId, setTrackingId] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleTrack = async () => {
    const trimmedId = trackingId.trim();
    if (!trimmedId) {
      toast.error("Please enter a tracking ID");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/public/track?trackingId=${encodeURIComponent(trimmedId)}`
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(json?.error || `Tracking ID not found`);
        return;
      }
      // record exists — navigate to public tracking page
      navigate(`/track/${encodeURIComponent(trimmedId)}`);
    } catch (err) {
      console.error("track error", err);
      toast.error("Network error — try again");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleTrack();
  };

  return (
    <section
      className="relative h-[80vh] md:h-[90vh] bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: `url(${heroImage})` }}
    >
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/60"></div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9 }}
        className="relative z-10 text-center text-white px-6"
      >
        <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
          Swift <span className="text-green-500">Logistics</span> <br />
          Reliable, Real-time Tracking
        </h1>
        <p className="text-lg md:text-xl max-w-3xl mx-auto mb-6 text-gray-200">
          Track all your deliveries with confidence — real-time updates, secure
          handling, zero hassle.
        </p>

        {/* Tracking Input */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-xl mx-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter Tracking ID"
              className="pl-10 pr-4 py-3 w-full rounded-full bg-white/90 text-gray-900 font-medium shadow-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
              aria-label="Tracking ID"
            />
          </div>

          <button
            onClick={handleTrack}
            disabled={loading}
            className={`px-8 py-3 rounded-full font-semibold transition shadow-md text-white ${
              loading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {loading ? "Checking..." : "Track"}
          </button>
        </div>

        {/* Helper Text */}
        <p className="mt-4 text-sm text-gray-300">
          Example: <span className="text-green-400">15b6fc6f-327a...</span>
        </p>
      </motion.div>
    </section>
  );
};

export default HeroSection;
