import HouseMark from "./HouseMark";


type AboutPageProps = {
  onLogoClick: () => void;
};

const aboutPhotoUrl = "/vym-photo.jpg";

export default function AboutPage({ onLogoClick }: AboutPageProps) {
  return (
    <main className="mapa-about-page">
      <div className="mapa-about-page__shell">
        <header className="mapa-about-page__topbar">
          <button className="mapa-about-page__brand" onClick={onLogoClick} type="button">
            <span className="mapa-about-page__brand-icon">
              <HouseMark className="mapa-about-page__house-icon" />
            </span>
            <span className="mapa-about-page__brand-wordmark">MAPAGUAPA</span>
          </button>
        </header>

        <section className="mapa-about-page__content">
          <div>
            <p className="mapa-about-page__eyebrow">Student mapping initiative</p>
            <h1>About Project MaPaGuaPa</h1>
          </div>

          {aboutPhotoUrl ? (
            <img className="mapa-about-page__photo-image" src={aboutPhotoUrl} alt="Viscan YouthMappers organization" />
          ) : (
            <div className="mapa-about-page__photo-frame" aria-label="Viscan YouthMappers organization photo placeholder">
              <div className="mapa-about-page__photo-mark">
                <HouseMark className="mapa-about-page__photo-icon" />
              </div>
              <p>Viscan YouthMappers photo</p>
            </div>
          )}

          <p className="mapa-about-page__copy">
            Project MaPaGuaPa is a student-led initiative by the Viscan YouthMappers, created to help students easily
            find accessible and suitable housing options based on their budget, location preferences, and accommodation
            needs. Originally developed as an academic study and strengthened through the collective efforts of student
            volunteers, contributors, and developers, Project MaPaGuaPa continues to promote accessibility, innovation,
            and service by connecting students with reliable accommodation information through a modern and user-friendly
            platform.
          </p>
        </section>

        <footer className="mapa-about-page__footer">
          <p className="mapa-about-page__powered-by">
            <span>Powered by</span>
            <a href="https://boyles-christian-portfolio.vercel.app/" rel="noreferrer" target="_blank">
              Lily Tech Solutions Co.
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
