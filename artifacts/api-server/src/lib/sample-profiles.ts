import type { NewProfile } from "@workspace/db";

type Person = [string, string, string, string, string, string, string[], string];
const people: Person[] = [
  ["Maya", "SJSU", "MIS", "Senior", "Making healthcare work better with technology", "Build accessible healthcare software as a product manager", ["Bouldering", "Cooking", "Indie music"], "Turning a clinic volunteer project into an app"],
  ["Jordan", "Stanford", "Computer Science", "Junior", "Code with a climate purpose", "Develop software for clean energy systems", ["Trail running", "Chess", "Photography"], "My solar forecasting side project"],
  ["Aisha", "Howard", "Nursing", "Senior", "Care that reaches everyone", "Bring patient-centered design into health technology", ["Cooking", "Poetry", "Volunteering"], "What patient interviews teach you about design"],
  ["Leo", "UC Berkeley", "Graphic Design", "Junior", "Designing things people actually understand", "Make complex financial tools accessible through design", ["Film", "Skateboarding", "Drawing"], "Redesigning a student budgeting app"],
  ["Sofia", "UCLA", "Marketing", "Senior", "Good stories deserve an audience", "Lead community-driven campaigns for sustainable brands", ["Thrifting", "Hiking", "Indie music"], "Growing our campus clothing swap"],
  ["Ethan", "Santa Clara", "Finance", "Analyst · 2 years out", "Numbers with a human side", "Fund affordable housing and community businesses", ["Basketball", "Cooking", "Podcasts"], "How community lending works"],
  ["Priya", "De Anza", "Psychology", "Sophomore", "Curious about how people learn", "Design evidence-based education tools", ["Reading", "Gaming", "Volunteering"], "Helping first-generation students find mentors"],
  ["Noah", "Arizona State", "Mechanical Engineering", "Senior", "Building practical climate solutions", "Engineer affordable electric transportation", ["Cycling", "Woodworking", "Camping"], "Building an electric bike from spare parts"],
  ["Camila", "University of Texas", "Communications", "Junior", "Science needs better storytellers", "Make public health communication more inclusive", ["Dance", "Podcasts", "Cooking"], "Our bilingual health newsletter"],
  ["Miles", "NYU", "Kinesiology", "Trainer · 1 year out", "Movement for every body", "Build adaptive fitness tools for rehabilitation", ["Basketball", "Yoga", "Gaming"], "Accessible strength training"],
  ["Zara", "SJSU", "Computer Science", "Senior", "Small apps, real impact", "Build assistive technology for disabled communities", ["Bouldering", "Gaming", "Drawing"], "My screen-reader-friendly campus map"],
  ["Owen", "Stanford", "Economics", "Junior", "Climate incentives that add up", "Work on carbon markets and clean energy policy", ["Chess", "Hiking", "Reading"], "Evaluating carbon removal projects"],
  ["Nia", "Howard", "Marketing", "Coordinator · 2 years out", "Helping independent creators grow", "Build an ethical creator-focused marketing studio", ["Poetry", "Photography", "Dance"], "Launching a local artist showcase"],
  ["Arjun", "UC Berkeley", "MIS", "Junior", "Better systems for small businesses", "Develop tools that help local shops compete", ["Cooking", "Chess", "Cycling"], "Digitizing inventory for a family grocery"],
  ["Grace", "UCLA", "Nursing", "Nurse · 1 year out", "Bridging bedside care and better tools", "Improve mental health access using digital triage", ["Yoga", "Reading", "Volunteering"], "Where patient intake can be kinder"],
  ["Theo", "Santa Clara", "Mechanical Engineering", "Junior", "Making sustainable products repairable", "Design circular consumer hardware", ["Woodworking", "Surfing", "Photography"], "Our repair cafe on campus"],
  ["Elena", "De Anza", "Graphic Design", "Sophomore", "Visual stories for community causes", "Design inclusive nonprofit campaigns", ["Drawing", "Thrifting", "Film"], "Making bilingual posters for a food bank"],
  ["Kai", "Arizona State", "Psychology", "Senior", "Human behavior meets better products", "Conduct user research for health and wellbeing apps", ["Gaming", "Trail running", "Indie music"], "Studying why people abandon wellness apps"],
  ["Isabel", "University of Texas", "Finance", "Senior", "Finance for a fairer future", "Make financial education approachable to young adults", ["Dance", "Podcasts", "Hiking"], "Running a budgeting workshop"],
  ["Ben", "NYU", "Computer Science", "Developer · 3 years out", "Making music tools for everyone", "Build collaborative software for independent musicians", ["Indie music", "Gaming", "Cooking"], "My open-source audio collaboration tool"],
  ["Amara", "Georgia Tech", "Biomedical Engineering", "Junior", "Better devices, fewer barriers", "Design low-cost rehabilitation devices", ["Basketball", "Drawing", "Volunteering"], "A 3D-printed grip aid prototype"],
  ["Luca", "University of Washington", "Environmental Science", "Senior", "Cities can be greener and fairer", "Create community-led urban climate projects", ["Cycling", "Camping", "Gardening"], "Mapping neighborhood heat islands"],
  ["Riley", "San Francisco State", "Communications", "Associate · 1 year out", "Bringing people into the conversation", "Run community programs for education nonprofits", ["Poetry", "Hiking", "Volunteering"], "Organizing a first-generation career panel"],
  ["Sana", "San Diego State", "Public Health", "Senior", "Prevention starts with listening", "Research food access and community health", ["Cooking", "Gardening", "Podcasts"], "Our student food-access survey"],
  ["Felix", "Purdue", "Industrial Engineering", "Junior", "Less waste in everyday systems", "Optimize sustainable food supply chains", ["Chess", "Camping", "Cooking"], "Reducing waste at campus dining"],
  ["Imani", "Spelman", "Sociology", "Senior", "Community knowledge is expertise", "Build equitable workforce development programs", ["Reading", "Dance", "Volunteering"], "Interviews with career-changing parents"],
  ["Mateo", "Cal Poly", "Architecture", "Junior", "Spaces that include everyone", "Design affordable accessible housing", ["Skateboarding", "Drawing", "Photography"], "An accessible tiny-home concept"],
  ["Lily", "University of Michigan", "Data Science", "Analyst · 2 years out", "Finding stories in messy data", "Apply data science to public health and prevention", ["Trail running", "Reading", "Cooking"], "Visualizing local health disparities"],
  ["Dev", "Rutgers", "Education", "Senior", "Teaching beyond the textbook", "Create playful technology for inclusive classrooms", ["Gaming", "Basketball", "Indie music"], "Teaching fractions through game design"],
  ["Quinn", "Portland State", "Business", "Founder · 3 years out", "Small business, lasting impact", "Grow a repair-and-reuse marketplace", ["Thrifting", "Cycling", "Woodworking"], "Testing a neighborhood tool library"],
];

export const sampleProfiles: NewProfile[] = people.map(([first_name, school, major, year, headline, career_goals, interests, ask_me_about]) => ({
  first_name, school, major, year, headline, career_goals, interests, ask_me_about, is_sample: true,
}));
