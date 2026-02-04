import Image from "next/image";
import { Navbar } from "@/modules/landing-page/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import studentsImage from "@/modules/images/studentsImage.png";

export default function LandingPage() {
  return (
    <div className="bg-background-light dark:bg-background-dark text-[#840132] dark:text-white font-display min-h-screen flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-grow flex flex-col justify-center relative">
        <div className="w-full px-6 lg:px-12 xl:px-40 py-12 lg:py-24">
          <div className="max-w-[1280px] mx-auto grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            <div className="flex flex-col gap-10 lg:order-1 order-2">
              <Card className="border-0 shadow-none bg-transparent">
                <CardContent className="p-0 space-y-6">
                  <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[1] text-[#840132]">
                    Join<span className="text-[#111418] dark:text-white">.</span>
                    <br />
                    Lead<span className="text-[#111418] dark:text-white">.</span>
                    <br />
                    Discover
                    <span className="text-[#111418] dark:text-white">.</span>
                  </h1>

                  <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 font-normal leading-relaxed max-w-lg">
                    Ditch the cluttered WhatsApp groups. Experience the unified
                    campus platform for event management, membership, and
                    vibrant student life at AUB.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 pt-2">
                    <Button className="group relative flex items-center justify-center h-16 px-10 rounded-full bg-[#840132] text-white text-lg font-bold shadow-2xl shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 w-full sm:w-auto">
                      <span className="flex items-center gap-2">
                        Explore Clubs
                        <span className="material-symbols-outlined text-[24px] group-hover:translate-x-1 transition-transform">
                          arrow_forward
                        </span>
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="relative lg:order-2 order-1 group">
              <div className="absolute -inset-4 bg-primary/5 rounded-[2.5rem] rotate-2 transform transition-transform group-hover:rotate-1" />

              <Card className="relative w-full aspect-[4/5] lg:aspect-square rounded-[2rem] overflow-hidden bg-white/50 dark:bg-gray-800 shadow-xl border border-white/20">
                <CardContent className="p-0 h-full">
                  <div className="relative w-full h-full">
                    <Image
                      src={studentsImage}
                      alt="AUB campus clubs"
                      fill
                      priority
                      className="object-cover object-center transition-transform duration-1000 group-hover:scale-105"
                    />

                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-transparent to-primary/5 mix-blend-multiply opacity-60" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-black/5 rounded-[2rem]" />

                    <div className="absolute bottom-10 left-8 right-8 flex flex-col gap-4">
                      <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/50 dark:border-white/10 flex items-center gap-4 self-start translate-x-[-10%] opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-700">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
                            <span className="material-symbols-outlined">
                              event_available
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                              Live Now
                            </p>
                            <p className="text-sm font-bold text-[#840132] dark:text-white leading-tight">
                              Club Fair 2026
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/50 dark:border-white/10 flex items-center gap-4 self-end translate-x-[10%] opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-700 delay-100">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="bg-primary p-2.5 rounded-xl text-white">
                            <span className="material-symbols-outlined">
                              groups
                            </span>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                              Community
                            </p>
                            <p className="text-sm font-bold text-[#840132] dark:text-white leading-tight">
                              60+ Official Clubs
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full py-12 border-t border-[#E5E5E0] dark:border-white/5">
        <div className="px-6 lg:px-12 xl:px-40 flex flex-col items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <p className="font-bold text-[#111418] dark:text-white">
            AUB Clubs Branded Platform
          </p>
          <p>© 2024 American University of Beirut. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
