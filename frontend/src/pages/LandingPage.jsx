"use client"

import { useState } from "react"
import {
  Heart,
  Menu,
  ArrowRight,
  CheckCircle,
  Users,
  Clock,
  Shield,
  Award,
  ChevronRight,
  ChevronLeft,
  Mail,
  Phone,
  MapPin,
  Star,
} from "lucide-react"

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false)
  const [featuresSlide, setFeaturesSlide] = useState(0)
  const [departmentsSlide, setDepartmentsSlide] = useState(0)

  const navigate = (path) => {
    window.location.href = path
  }

  const departments = [
    {
      id: "emergency",
      name: "Emergency Department",
      icon: "🚨",
      path: "/patient/login",
      description: "24/7 critical care services",
      color: "from-red-500 to-orange-500",
    },
    {
      id: "pediatric",
      name: "Pediatric Department",
      icon: "👶",
      path: "/patient/login",
      description: "Specialized child healthcare",
      color: "from-pink-500 to-rose-500",
    },
    {
      id: "obstetrics",
      name: "Obstetrics & Gynecology",
      icon: "🤰",
      path: "/patient/login",
      description: "Maternal and women's health",
      color: "from-purple-500 to-pink-500",
    },
    {
      id: "cardiology",
      name: "Cardiology Department",
      icon: "❤️",
      path: "/patient/login",
      description: "Advanced heart care",
      color: "from-red-600 to-pink-600",
    },
    {
      id: "neurology",
      name: "Neurology Department",
      icon: "🧠",
      path: "/patient/login",
      description: "Brain and nervous system",
      color: "from-indigo-500 to-purple-500",
    },
    {
      id: "psychiatry",
      name: "Psychiatry Department",
      icon: "🧘",
      path: "/patient/login",
      description: "Mental health support",
      color: "from-teal-500 to-emerald-500",
    },
  ]

  const features = [
    {
      icon: <Users className="w-7 h-7" />,
      title: "Expert Team",
      description: "Board-certified specialists with decades of combined experience",
    },
    {
      icon: <Clock className="w-7 h-7" />,
      title: "24/7 Available",
      description: "Round-the-clock emergency care whenever you need it",
    },
    {
      icon: <Shield className="w-7 h-7" />,
      title: "Secure & Private",
      description: "HIPAA compliant systems protecting your health data",
    },
    {
      icon: <Award className="w-7 h-7" />,
      title: "Award Winning",
      description: "Recognized healthcare excellence and patient satisfaction",
    },
  ]

  // Calculate visible items for sliders
  const getVisibleItems = (items, currentSlide, itemsPerView) => {
    return items.slice(currentSlide, currentSlide + itemsPerView)
  }

  const handleFeaturesPrev = () => {
    setFeaturesSlide(Math.max(0, featuresSlide - 1))
  }

  const handleFeaturesNext = () => {
    setFeaturesSlide(Math.min(features.length - 1, featuresSlide + 1))
  }

  const handleDepartmentsPrev = () => {
    setDepartmentsSlide(Math.max(0, departmentsSlide - 1))
  }

  const handleDepartmentsNext = () => {
    setDepartmentsSlide(Math.min(departments.length - 1, departmentsSlide + 1))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* ============ HEADER ============ */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  Recure360
                </span>
                <p className="text-xs text-gray-500">Healthcare Excellence</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#home" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Home
              </a>
              <a href="#about" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                About
              </a>
              <a href="#services" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Services
              </a>
              <a href="#departments" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Departments
              </a>

              <div className="relative">
                <button
                  onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-2.5 rounded-full hover:shadow-lg transition-all font-medium flex items-center space-x-2"
                >
                  <span>Get Started</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${loginDropdownOpen ? "rotate-90" : ""}`} />
                </button>
                {loginDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                    <button
                      onClick={() => {
                        navigate("/patient/login")
                        setLoginDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 font-medium text-gray-700 border-b border-gray-100 flex items-center space-x-2"
                    >
                      <Users className="w-4 h-4" />
                      <span>Patient Login</span>
                    </button>
                    <button
                      onClick={() => {
                        navigate("/doctor/login")
                        setLoginDropdownOpen(false)
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 font-medium text-gray-700 flex items-center space-x-2"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Doctor Login</span>
                    </button>
                  </div>
                )}
              </div>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 py-4">
            <div className="max-w-7xl mx-auto px-4 space-y-3">
              <a href="#home" className="block text-gray-700 hover:text-blue-600 font-medium py-2">
                Home
              </a>
              <a href="#about" className="block text-gray-700 hover:text-blue-600 font-medium py-2">
                About
              </a>
              <a href="#services" className="block text-gray-700 hover:text-blue-600 font-medium py-2">
                Services
              </a>
              <a href="#departments" className="block text-gray-700 hover:text-blue-600 font-medium py-2">
                Departments
              </a>
              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={() => navigate("/patient/login")}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-2.5 rounded-full font-medium mb-2"
                >
                  Patient Login
                </button>
                <button
                  onClick={() => navigate("/doctor/login")}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2.5 rounded-full font-medium"
                >
                  Doctor Login
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ============ HERO SECTION ============ */}
      <section id="home" className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 opacity-50"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div
          className="absolute bottom-20 left-10 w-72 h-72 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"
          style={{ animationDelay: "700ms" }}
        ></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                <span className="text-sm font-semibold">Trusted by 150K+ Patients</span>
              </div>

              <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 leading-tight">
                Compassionate
                <span className="block bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 bg-clip-text text-transparent">
                  Healthcare
                </span>
                For Everyone
              </h1>

              <p className="text-xl text-gray-600 leading-relaxed max-w-xl">
                Experience world-class medical care with our team of dedicated professionals. Your health journey starts
                here.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative">
                  <button
                    onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
                    className="group bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-4 rounded-full hover:shadow-2xl transition-all font-semibold flex items-center justify-center space-x-2 w-full sm:w-auto"
                  >
                    <span>Book Appointment</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  {loginDropdownOpen && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                      <button
                        onClick={() => {
                          navigate("/patient/login")
                          setLoginDropdownOpen(false)
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 font-medium text-gray-700 border-b border-gray-100 flex items-center space-x-2"
                      >
                        <Users className="w-4 h-4" />
                        <span>Patient Login</span>
                      </button>
                      <button
                        onClick={() => {
                          navigate("/doctor/login")
                          setLoginDropdownOpen(false)
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 font-medium text-gray-700 flex items-center space-x-2"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Doctor Login</span>
                      </button>
                    </div>
                  )}
                </div>
                <button className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-full hover:border-blue-600 hover:text-blue-600 transition-all font-semibold">
                  Learn More
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-8">
                <div className="text-center sm:text-left">
                  <div className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    20+
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Years Experience</div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    95%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Satisfaction Rate</div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    5K+
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Patients Yearly</div>
                </div>
                <div className="text-center sm:text-left">
                  <div className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    10+
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Specialists</div>
                </div>
              </div>
            </div>

            {/* Right Content - Hero Image */}
            <div className="relative">
              <div className="relative bg-white/40 backdrop-blur-sm rounded-3xl p-6 shadow-2xl">
                <div className="aspect-[4/3] bg-gradient-to-br from-blue-400 via-cyan-400 to-teal-400 rounded-2xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <div className="text-center text-white">
                      <Heart className="w-20 h-20 mx-auto mb-4 opacity-80" />
                      <p className="text-lg font-semibold">Your Health, Our Priority</p>
                    </div>
                  </div>
                </div>

                {/* Floating Card */}
                <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl px-6 py-4 shadow-xl border border-gray-100">
                  <div className="flex items-center space-x-4">
                    <div className="flex -space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full border-4 border-white"></div>
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full border-4 border-white"></div>
                      <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full border-4 border-white"></div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">150K+</div>
                      <div className="text-sm text-gray-600">Happy Patients</div>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>

                {/* Rating Badge */}
                <div className="absolute -top-4 -right-4 bg-gradient-to-br from-orange-400 to-pink-500 text-white rounded-2xl px-6 py-3 shadow-xl">
                  <div className="flex items-center space-x-2">
                    <Star className="w-5 h-5 fill-current" />
                    <div>
                      <div className="font-bold">4.9/5</div>
                      <div className="text-xs opacity-90">Rating</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES SECTION WITH MOBILE SLIDER ============ */}
      <section id="services" className="py-16 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Why Choose Us</h2>
            <p className="text-lg text-gray-600">Excellence in healthcare delivery</p>
          </div>

          {/* Desktop Grid - Hidden on Mobile */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-gradient-to-br from-white to-blue-50 rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all border border-blue-100 hover:border-blue-300 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-10 rounded-full blur-2xl transition-opacity"></div>
                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Slider */}
          <div className="md:hidden">
            <div className="flex overflow-hidden gap-4">
              {getVisibleItems(features, featuresSlide, 1).map((feature, index) => (
                <div
                  key={index}
                  className="flex-shrink-0 w-full group bg-gradient-to-br from-white to-blue-50 rounded-2xl p-6 shadow-lg border border-blue-100 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-10 rounded-full blur-2xl"></div>
                  <div className="relative">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center text-white mb-4">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Mobile Slider Controls */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={handleFeaturesPrev}
                disabled={featuresSlide === 0}
                className="p-2 rounded-full bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex gap-2">
                {features.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setFeaturesSlide(idx)}
                    className={`w-2 h-2 rounded-full transition ${featuresSlide === idx ? "bg-blue-600 w-6" : "bg-gray-300"}`}
                  />
                ))}
              </div>
              <button
                onClick={handleFeaturesNext}
                disabled={featuresSlide === features.length - 1}
                className="p-2 rounded-full bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============ DEPARTMENTS SECTION - MODERN PREMIUM GRID ============ */}
      <section
        id="departments"
        className="py-24 bg-gradient-to-b from-white via-slate-50 to-slate-100 relative overflow-hidden"
      >
        {/* Premium background effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-300 to-cyan-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse"></div>
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-br from-cyan-300 to-teal-300 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20">
            <div className="inline-block mb-6">
              <div className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 px-4 py-2 rounded-full text-sm font-bold">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                <span>SPECIALIZED CARE EXCELLENCE</span>
              </div>
            </div>
            <h2 className="text-5xl lg:text-6xl font-black text-gray-900 leading-tight mb-6">
              World-Class Departments
            </h2>
            <p className="text-xl lg:text-2xl text-gray-600 max-w-3xl mx-auto font-light">
              Access specialized care across multiple disciplines with cutting-edge technology and compassionate
              professionals
            </p>
          </div>

          <div className="hidden lg:block">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 auto-rows-max">
              {/* Featured Card - Takes 2 rows */}
              <div className="lg:row-span-2 group cursor-pointer" onClick={() => navigate(departments[0].path)}>
                <div className="relative h-full bg-gradient-to-br from-red-500 via-red-600 to-orange-600 rounded-3xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-500 transform hover:scale-105">
                  <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>

                  <div className="relative h-full flex flex-col justify-between p-12">
                    <div>
                      <div className="text-7xl mb-6 filter drop-shadow-lg">{departments[0].icon}</div>
                      <h3 className="text-4xl font-black text-white mb-3 leading-tight">{departments[0].name}</h3>
                      <p className="text-lg text-red-50 font-light">{departments[0].description}</p>
                    </div>
                    <div className="flex items-center text-white font-bold text-sm group-hover:translate-x-2 transition-transform">
                      <span>Explore Services</span>
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </div>
                  </div>

                  <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                </div>
              </div>

              {/* Right Column Cards */}
              {departments.slice(1, 4).map((dept, idx) => (
                <div key={dept.id} className="group cursor-pointer" onClick={() => navigate(dept.path)}>
                  <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 border border-white/50 hover:border-white/80 p-8 h-full hover:translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-cyan-50/30 -z-10"></div>

                    <div className="flex items-start justify-between mb-6">
                      <div className="text-5xl">{dept.icon}</div>
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {dept.name}
                    </h3>
                    <p className="text-gray-600 text-sm font-light mb-6 leading-relaxed">{dept.description}</p>

                    <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full w-0 group-hover:w-full transition-all duration-500"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Row - 3 Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
              {departments.slice(4).map((dept) => (
                <div key={dept.id} className="group cursor-pointer" onClick={() => navigate(dept.path)}>
                  <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 border border-white/50 hover:border-white/80 p-8 hover:translate-y-1">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-cyan-50/30 -z-10"></div>

                    <div className="flex items-start justify-between mb-6">
                      <div className="text-5xl">{dept.icon}</div>
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {dept.name}
                    </h3>
                    <p className="text-gray-600 text-sm font-light mb-6 leading-relaxed">{dept.description}</p>

                    <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full w-0 group-hover:w-full transition-all duration-500"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:hidden">
            <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory">
              {departments.map((dept, idx) => (
                <div
                  key={dept.id}
                  className="flex-shrink-0 w-full sm:w-96 snap-center group cursor-pointer"
                  onClick={() => navigate(dept.path)}
                >
                  <div className="relative h-80 bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-600 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>

                    <div className="relative h-full flex flex-col justify-between p-6">
                      <div>
                        <div className="text-6xl mb-4">{dept.icon}</div>
                        <h3 className="text-2xl font-bold text-white mb-2">{dept.name}</h3>
                        <p className="text-sm text-blue-100">{dept.description}</p>
                      </div>

                      <div className="flex items-center text-white font-semibold text-sm">
                        <span>Explore</span>
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/20 rounded-full blur-xl"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ ABOUT SECTION ============ */}
      <section id="about" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Image */}
            <div className="relative order-2 lg:order-1">
              <div className="relative bg-gradient-to-br from-blue-100 via-cyan-100 to-teal-100 rounded-3xl aspect-[4/3] overflow-hidden shadow-2xl">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Shield className="w-24 h-24 mx-auto text-blue-500 opacity-50 mb-4" />
                    <p className="text-gray-500 font-semibold">Trusted Healthcare Provider</p>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full opacity-20 blur-2xl"></div>
              <div className="absolute -top-6 -left-6 w-32 h-32 bg-gradient-to-br from-teal-500 to-green-500 rounded-full opacity-20 blur-2xl"></div>
            </div>

            {/* Right - Content */}
            <div className="order-1 lg:order-2 space-y-6">
              <div className="inline-block bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold">
                About Recure360
              </div>

              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                Leading Healthcare Innovation Since 2005
              </h2>

              <p className="text-lg text-gray-600 leading-relaxed">
                We're a team of experienced medical professionals dedicated to providing top-quality healthcare
                services. Our holistic approach focuses on treating the whole person, not just symptoms.
              </p>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Personalized Care Plans</h4>
                    <p className="text-gray-600 text-sm">Tailored treatment strategies for your unique needs</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Advanced Technology</h4>
                    <p className="text-gray-600 text-sm">State-of-the-art medical equipment and facilities</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Compassionate Team</h4>
                    <p className="text-gray-600 text-sm">Caring professionals who put patients first</p>
                  </div>
                </div>
              </div>

              {/* Portal Access Buttons */}
              <div className="pt-6">
                <p className="text-sm font-semibold text-gray-700 mb-4">Quick Access Portal:</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => navigate("/doctor/login")}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all font-medium"
                  >
                    Doctor Login
                  </button>
                  <button
                    onClick={() => navigate("/patient/login")}
                    className="bg-gradient-to-r from-cyan-600 to-teal-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all font-medium"
                  >
                    Patient Login
                  </button>
                  <button
                    onClick={() => navigate("/admin/login")}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all font-medium"
                  >
                    Admin Login
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CTA SECTION ============ */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full opacity-10 blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full opacity-10 blur-3xl translate-x-1/2 translate-y-1/2"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center">
            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">Ready to Start Your Health Journey?</h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Book an appointment today and experience healthcare that puts you first
            </p>
            <div className="relative inline-block">
              <button
                onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
                className="bg-white text-blue-600 px-8 py-4 rounded-full hover:shadow-2xl transition-all font-bold text-lg inline-flex items-center space-x-2"
              >
                <span>Book Appointment Now</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              {loginDropdownOpen && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                  <button
                    onClick={() => {
                      navigate("/patient/login")
                      setLoginDropdownOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 font-medium text-gray-700 border-b border-gray-100 flex items-center space-x-2"
                  >
                    <Users className="w-4 h-4" />
                    <span>Patient Login</span>
                  </button>
                  <button
                    onClick={() => {
                      navigate("/doctor/login")
                      setLoginDropdownOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 font-medium text-gray-700 flex items-center space-x-2"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Doctor Login</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-gray-900 text-gray-300 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">Recure360</span>
              </div>
              <p className="text-gray-400 leading-relaxed mb-4">
                Compassionate care and exceptional results for all our patients. Your health is our mission.
              </p>
              <div className="flex space-x-3">
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer">
                  <span className="text-sm">f</span>
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer">
                  <span className="text-sm">in</span>
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer">
                  <span className="text-sm">tw</span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-bold mb-6 text-lg">Quick Links</h4>
              <ul className="space-y-3">
                <li>
                  <a href="#about" className="hover:text-blue-400 transition-colors flex items-center space-x-2">
                    <ChevronRight className="w-4 h-4" />
                    <span>About Us</span>
                  </a>
                </li>
                <li>
                  <a href="#services" className="hover:text-blue-400 transition-colors flex items-center space-x-2">
                    <ChevronRight className="w-4 h-4" />
                    <span>Services</span>
                  </a>
                </li>
                <li>
                  <a href="#departments" className="hover:text-blue-400 transition-colors flex items-center space-x-2">
                    <ChevronRight className="w-4 h-4" />
                    <span>Departments</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Portal Access */}
            <div>
              <h4 className="text-white font-bold mb-6 text-lg">Portal Access</h4>
              <ul className="space-y-3">
                <li>
                  <button
                    onClick={() => navigate("/doctor/login")}
                    className="hover:text-blue-400 transition-colors flex items-center space-x-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>Doctor Login</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/patient/login")}
                    className="hover:text-blue-400 transition-colors flex items-center space-x-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>Patient Login</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/admin/login")}
                    className="hover:text-blue-400 transition-colors flex items-center space-x-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>Admin Login</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-white font-bold mb-6 text-lg">Contact Info</h4>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <Mail className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <p className="text-white">support@recure360.com</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <Phone className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-gray-400">24/7 Helpline</p>
                    <p className="text-white">1-800-RECURE-360</p>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm text-gray-400">Emergency Care</p>
                    <p className="text-white">Available 24/7</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-sm text-gray-400">
                &copy; 2025 Recure360. All rights reserved. | Privacy Policy | Terms of Service
              </p>
              <p className="text-sm text-gray-400">
                Made with <Heart className="w-4 h-4 inline text-red-500 fill-current" /> for better healthcare
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
