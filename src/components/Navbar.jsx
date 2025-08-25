// src/components/Navbar.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logo from "../assets/logo.png"; // your logo

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2">
          <img src={logo} alt="Logo" className="h-8 w-auto" />
          <span className="font-bold text-2xl text-green-700">
            Swift Logistics
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex space-x-10 font-medium text-gray-700">
          <Link to="/" className="hover:text-green-600">
            Home
          </Link>
          <Link
            to="/track/15b6fc6f-327a-4ec4-896f-486349e85a5d"
            className="hover:text-green-600"
          >
            Track
          </Link>
          <Link to="/contact" className="hover:text-green-600">
            Contact
          </Link>
        </nav>

        {/* CTA */}
        <Link
          to="/track/15b6fc6f-327a-4ec4-896f-486349e85a5d"
          className="hidden md:inline-block bg-green-600 text-white px-6 py-2 rounded-full shadow hover:bg-green-700 transition"
        >
          Track Package
        </Link>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden text-gray-700"
        >
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden bg-white border-t shadow-sm transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        <nav className="flex flex-col items-center space-y-5 py-5 font-medium">
          <Link to="/" onClick={() => setIsOpen(false)}>
            Home
          </Link>
          <Link
            to="/track/15b6fc6f-327a-4ec4-896f-486349e85a5d"
            onClick={() => setIsOpen(false)}
          >
            Track
          </Link>
          <Link to="/contact" onClick={() => setIsOpen(false)}>
            Contact
          </Link>
          <Link
            to="/track/15b6fc6f-327a-4ec4-896f-486349e85a5d"
            className="bg-green-600 text-white px-6 py-2 rounded-full shadow hover:bg-green-700 transition"
            onClick={() => setIsOpen(false)}
          >
            Track Package
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
