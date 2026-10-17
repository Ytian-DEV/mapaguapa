import { useEffect } from "react";
import { useAuth } from "../../app/AuthProvider";
import { homeFor } from "../../app/guards";
import { ButtonLink, Logo } from "../../ui";
import "./about.css";

/** About Project MaPaGuaPa (public). */
export default function AboutPage() {
  const { profile } = useAuth();
  const home = profile ? homeFor(profile.role) : "/sign-in";

  useEffect(() => {
    document.title = "About · mapaguapa";
  }, []);

  return (
    <div className="v2 about">
      <header className="v2-container about__top">
        <Logo to={home} />
        <ButtonLink size="sm" to={home} variant="secondary">
          {profile ? "Back to the app" : "Sign in"}
        </ButtonLink>
      </header>

      <main className="v2-container about__main" id="main">
        <p className="v2-eyebrow">Student mapping initiative</p>
        <h1 className="v2-display">About Project MaPaGuaPa</h1>
        <img alt="Members of the Viscan YouthMappers" className="about__photo" src="/vym-photo.jpg" />
        <p className="about__copy">
          Project MaPaGuaPa is a student-led initiative by the Viscan YouthMappers, created to help students easily find accessible and suitable
          housing options based on their budget, location preferences, and accommodation needs. Originally developed as an academic study and
          strengthened through the collective efforts of student volunteers, contributors, and developers, Project MaPaGuaPa continues to promote
          accessibility, innovation, and service by connecting students with reliable accommodation information through a modern and
          user-friendly platform.
        </p>
      </main>

      <footer className="v2-container about__footer">
        Powered by{" "}
        <a href="https://boyles-christian-portfolio.vercel.app/" rel="noreferrer" target="_blank">
          Lily Tech Solutions Co.
        </a>
      </footer>
    </div>
  );
}
