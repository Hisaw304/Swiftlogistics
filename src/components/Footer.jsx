// src/components/Footer.jsx
import React from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-10">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* Brand */}
        <div>
          <h3 className="text-xl font-bold text-white mb-3">Swift Logistics</h3>
          <p className="text-gray-400">
            Reliable delivery solutions tailored for you. Fast, secure, and
            trusted worldwide.
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 className="font-semibold text-white mb-3">Company</h4>
          <ul className="space-y-2">
            <li>
              <Link to="/" className="hover:text-green-500">
                Home
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-green-500">
                Contact
              </Link>
            </li>
            <li>
              <Link
                to="/track/15b6fc6f-327a-4ec4-896f-486349e85a5d"
                className="hover:text-green-500"
              >
                Track
              </Link>
            </li>
          </ul>
        </div>

        {/* Support */}
        <div>
          <h4 className="font-semibold text-white mb-3">Support</h4>
          <ul className="space-y-2">
            <li>
              <a href="/faq" className="hover:text-green-500">
                FAQ
              </a>
            </li>
            <li>
              <a href="/help" className="hover:text-green-500">
                Help Center
              </a>
            </li>
            <li>
              <a href="/terms" className="hover:text-green-500">
                Terms & Conditions
              </a>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-semibold text-white mb-3">Get in Touch</h4>
          <p>Email: support@swiftlogistics.com</p>
          <p>Phone: +1 (555) 123-4567</p>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-gray-700 py-4 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} Swift Logistics. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
