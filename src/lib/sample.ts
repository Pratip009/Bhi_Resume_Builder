import { emptyResume, newId, type Resume } from "./schema";

export function sampleResume(): Resume {
  const r = emptyResume();
  return {
    ...r,
    personal: {
      fullName: "Maya Okafor",
      headline: "Senior Product Engineer",
      email: "maya.okafor@example.com",
      phone: "+1 415 555 0142",
      location: "San Francisco, CA",
      website: "mayaokafor.dev",
      linkedin: "linkedin.com/in/mayaokafor",
      github: "github.com/mayaokafor",
      photo: "",
    },
    summary:
      "Product engineer with 8 years building web platforms used by millions. I pair strong TypeScript and systems fundamentals with a habit of talking to customers, and I like owning features end to end, from the first sketch to the on-call rotation.",
    experience: [
      {
        id: newId(),
        role: "Senior Product Engineer",
        company: "Lumen Payments",
        location: "San Francisco, CA",
        start: "Mar 2021",
        end: "",
        current: true,
        bullets:
          "Led the rebuild of merchant onboarding in Next.js, cutting median sign-up time from 14 to 5 minutes\nDesigned an idempotent webhook delivery service handling 40M events a day at 99.99% delivery\nMentored four engineers; two were promoted within a year",
      },
      {
        id: newId(),
        role: "Software Engineer",
        company: "Fieldnote",
        location: "Remote",
        start: "Jun 2017",
        end: "Feb 2021",
        current: false,
        bullets:
          "Built the collaborative editor's offline sync using CRDTs, reducing conflict reports by 80%\nIntroduced end-to-end tests that caught 120+ regressions before release",
      },
    ],
    education: [
      {
        id: newId(),
        degree: "B.S. Computer Science",
        school: "University of Washington",
        location: "Seattle, WA",
        start: "2013",
        end: "2017",
        grade: "GPA 3.8",
        details: "",
      },
    ],
    skills: [
      { id: newId(), name: "Languages", items: "TypeScript, Go, Python, SQL" },
      { id: newId(), name: "Frameworks", items: "React, Next.js, Node.js, tRPC" },
      { id: newId(), name: "Infrastructure", items: "PostgreSQL, Redis, AWS, Terraform, Docker" },
    ],
    projects: [
      {
        id: newId(),
        name: "Tidepool",
        link: "github.com/mayaokafor/tidepool",
        tech: "Go, SQLite",
        start: "2023",
        end: "",
        bullets: "Open-source rate limiter used in production by 30+ companies; 2.1k GitHub stars",
      },
    ],
    certifications: [
      { id: newId(), name: "AWS Certified Solutions Architect – Associate", issuer: "Amazon Web Services", date: "2022", link: "" },
    ],
    awards: [],
    volunteer: [],
    languages: [
      { id: newId(), name: "English", level: "Native" },
      { id: newId(), name: "Yoruba", level: "Conversational" },
    ],
    interests: "Bouldering, film photography, community radio",
    references: [],
    referencesOnRequest: true,
    custom: [],
  };
}
