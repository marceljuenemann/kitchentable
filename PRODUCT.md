# Kitchentable — Product Doc

This doc outlines plans for building a non-profit dating app focused on the ENM (ethically non-monogamous) community.

## Mission

*(Draft, not finalized)*

**"Combat loneliness by facilitating authentic connections and community"**

## Roadmap

- [x] **Survey to validate demand for a new app** — results showed a lot of dissatisfaction with existing solutions
- [ ] **MVP:** Simple dating app to validate that people will actually sign up (target: 100 users)
- [ ] **Viable community:** Get to 1000+ active users with a positive net promoter score
- [ ] **Sustainable non-profit:** Validate that costs and labour can be covered through donations or other funding sources (without for-profit investors or dividends, or paywalling basic features)
- [ ] **Scaling:** If the model is successful and sustainable, scale it globally. Could also consider expanding beyond ENM communities, although that would probably be a separate app, just sharing the tech
- [ ] **Beyond dating:** There are also opportunities to expand in depth rather than just reach, e.g. by leaning more into community building and education on skills for healthy relationships

## Principles

- **Quality over quantity**, in terms of users and in terms of connections
- **Inclusive.** Be inclusive to marginalized groups, especially queer, ENM, people with disabilities, neurodiverse folks, people of colour
- **Community-driven.** Very much involve the community (ENM folks, active users) in decision making, especially when it comes to things like moderation guidelines
- **Opinionated.** Informed by latest scientific evidence, have an opinion on what tends to lead to satisfying connections and relationships, without judging people. Encourage emotional intimacy and transparency in what people truly desire
- TBD

## Hypotheses

- A non-profit dating app can provide a much better user experience than for-profit apps that charge for basic features such as seeing likes. Therefore, it can spread through word of mouth rather than through a significant marketing budget.
- There is enough demand in the London ENM community to reach the initial critical mass of users.
- The tech behind dating apps is fairly trivial, especially in the age of AI.

## Branding

> **Work in progress** — logo and flag images to be added to the repo.

- *Kitchen Table* as a name is a reference to Kitchen Table Polyamory (a style of ENM relationships where everyone gets along well enough to sit down at a kitchen table together)
  - This not just ties the branding directly to ENM, but also communicates that we value community and getting along
  - Of course, the app is also open to people not into Kitchen Table Polyamory. Whether this reference puts anyone off remains to be seen
  - `kitchentable.dating` reserved as domain
- The logo abstractly represents a Kitchen Table (round table with four arcs representing chairs) and uses the colours of the new polyamory flag
- Reference — polyamory flag colours:
  - **Red** — love and attraction (carried over from the original 1995 "pi" flag)
  - **Blue** — openness and honesty (also carried over)
  - **Gold** — the energy and perseverance of the non-monogamous community
  - **Purple** — a united non-monogamous community
  - **White chevron** — flows outward asymmetrically to represent the growth, possibility, and non-traditional structure of polyamorous relationships
  - **Gold heart** — a reminder that love, in all its forms, is the core of non-monogamy

## Business Model

### Short-term

Self-funded initial development, run via the founder's Ltd. The London ENM community is small enough that maintaining an app exclusively for this community shouldn't require full-time staff, especially if community members are happy to help out with some tasks (e.g. moderation).

### Long-term

If the app is successful and grows beyond what's maintainable as a side project, the plan is to create a Community Interest Company (CIC) to enshrine the non-profit model legally. At that point, there might be some significant ongoing costs:

**Costs**

- Server & infrastructure (minimal)
- Age verification according to the Online Safety Act (~50p / user?)
- Moderation work: handling reports, vetting etc. — could lean heavily into AI and/or volunteers, but some paid staff would probably lead to a better experience for everyone
- Ongoing software development
- General business development, management & leadership

**Funding**

- **Grants.** Many grants are available for CICs, and positioning the app as tackling the loneliness epidemic seems promising. Although the stigma around both "dating apps" and "non-monogamy" might be a problem both with incorporating a CIC and getting grants. There might also be social enterprise loans available rather than grants
- **Donations.** Asking users for donations at the right moment, e.g. after they've set up a date. Or possibly a "supporter" badge for subscribers without offering any special features?
- **Partnerships.** Promoting trusted relationship coaches and therapists (or their courses) inside the app
- **Events.** Running in-person dating events or relationship skill courses — hard to scale though

Preference is to steer well clear of any user payments or freemium models, as they tend to compromise the user experience. If needed, there might be transparent and ethical ways to do it (e.g. a limited number of boosts, clearly marked as such).

### Transition

One thing to avoid is growing too quickly before having a sustainable model other than the founder doing everything for free. With the invite-only & vetting model it should be fairly easy to regulate user inflow — onboarding of new users can always be paused until processes have been made more sustainable or automated.

A possible way to move to a donation-based model is to run a crowdfunding campaign at ~1000 users or so. Although if that ends up asking users for money as aggressively as existing dating apps do, it might undermine the non-profit messaging. A better route might be to introduce in-app donations early, measure LTV per user, and project how many users would be required to cover baseline costs.

Note also that the transition from Ltd to CIC is not trivial — it would require explicit user consent to move their data controller, especially given sensitive data such as sexual orientation is involved.

## Governance

**Short-term:** All decisions made by the founder, consulting with a WhatsApp group of people interested in the project.

**Long-term:** Incorporating a CIC would require a board of at least 2-3 people. In-app surveys for important decisions, or elections of user representatives (e.g. for moderation guidelines), are both possibilities. That said, a fully democratic decision-making model probably doesn't lead to great products — trying to make everyone happy tends to produce compromised products that nobody really loves. Better to have a leadership team of 2-3 people with diverse perspectives who do a good job listening to the community and making it workable for a wide range of users.

## Minimum Viable Product (MVP)

> The goal is to validate the hypotheses above as quickly as possible. So instead of coming up with fancy new features from the start, just build a basic dating app along the lines of existing apps and see if it can reach critical mass.

### Invite only

Signing up requires an invite code (in the URL). Initially shared out in existing ENM communities and in-person; later on people could create their own invite links.

Benefits of the invite-only model:

- Avoid spam and fake profiles (if someone keeps inviting those, they lose invite privileges)
- Avoid some creeps that use dating apps but aren't part of the ENM community at all (obviously can't keep all creeps out though)
- Control inflow of sign-ups
- Make membership feel more valuable and less anonymous, encouraging more adherence to moderation and community guidelines

This is not intended as gate-keeping though — anybody with good intentions and willing to put in some effort is welcome.

### Profile

- Name
- Pronouns
- Pictures
- Tagline (shown prominently to give something other than just pictures to go on)
- Profile text
- Gender
- Sexuality
- Age (ask for year and month of birth)
- Location (only London for now, can consider more fine-grained in the future)
- What connections are you looking for?
- TBD

### Search

For the very first version, maybe just show all profiles with filters for the above.

Can add more algorithms once there are actual users.

### Making Connections

- Require an intro message instead of just liking a profile
- Select what type of connections you are interested in (ENM dating, friends etc.)
- Limit to 3 (?) intros / likes per day for people to be more selective and spend more time on quality introductions
  - Therefore, swiping is probably not the right UX. Probably just show people a list of all people matching their criteria (like OKCupid used to do) with the ability to dismiss people.

## Future Ideas

- Connecting to partners in the app
- Implement various (transparent) algorithms that users can choose from
- Integrate educational content (secure attachment, relationship escalator, ENM knowledge etc.)
- Add a bunch of "tests" that might be a good predictor for good matches
- Community features, e.g. votes, discussions, event buddies etc.
- Limit on incoming messages?
- Show (only positive) references from friends and partners on your profile?
- TBD
