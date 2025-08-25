import React from "react";
import Hero from "../components/Hero";
import TrustedBanner from "../components/TrustedBanner";

import Testimonials from "../components/Testimonials";
import ContactForm from "../components/ContactForm";
import FeaturesSection from "../components/FeaturesSection";
import WhyShipWithUs from "../components/WhyShipWithUs";
const Home = () => {
  return (
    <>
      <Hero />
      <FeaturesSection />
      <WhyShipWithUs />
      <TrustedBanner />
      <Testimonials />
      <ContactForm />
    </>
  );
};

export default Home;
