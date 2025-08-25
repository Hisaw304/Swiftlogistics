// src/pages/ContactPage.jsx
import React from "react";
import ContactForm from "../components/ContactForm";
import { motion } from "framer-motion";

const Contact = () => {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      {/* Contact Form */}
      <ContactForm />

      {/* Contact Info Cards */}
      <motion.div
        className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto px-6 mt-20"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <div className="p-6 bg-gray-50 rounded-lg shadow text-center">
          <h4 className="font-semibold mb-2 text-lg">📞 Call Us</h4>
          <p className="text-gray-600">+1 (234) 567-890</p>
        </div>
        <div className="p-6 bg-gray-50 rounded-lg shadow text-center">
          <h4 className="font-semibold mb-2 text-lg">📧 Email</h4>
          <p className="text-gray-600">support@yourcompany.com</p>
        </div>
        <div className="p-6 bg-gray-50 rounded-lg shadow text-center">
          <h4 className="font-semibold mb-2 text-lg">⏰ Office Hours</h4>
          <p className="text-gray-600">Mon–Fri: 9am–6pm</p>
        </div>
      </motion.div>

      {/* Map Section */}
      <motion.div
        className="max-w-5xl mx-auto px-6 mt-20 mb-20"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <h3 className="text-2xl font-semibold mb-6 text-center">
          Our Location
        </h3>
        <div className="w-full h-72 md:h-96 rounded-lg overflow-hidden shadow-lg">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3153.0865074980243!2d-122.41941508468146!3d37.77492927975909!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x80858064d12345%3A0xabcd1234abcd5678!2sSan%20Francisco!5e0!3m2!1sen!2sus!4v1616436712345!5m2!1sen!2sus"
            width="100%"
            height="100%"
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      </motion.div>
    </div>
  );
};

export default Contact;
