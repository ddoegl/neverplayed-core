we already reimplemented the whole backoffice in the new osgi architecture as a
pluggable serviced based system

next I want to build the foundation for the overall experience, drawing from the
existing implementations in client/connect/authorizationV2/content/flows/

we generally distinguish between a mobile and a desktop experience the already
reimplemented backoffice is a desktop experience

the mobile experiences share a common base - the mobile phone experience, that
provides the framework for the mobile experience with the simulated mobile phone

- client/connect/authorizationV2/content/flows/real-life the bundle for main
  entry page, being the gateway to all other contexts

- client/connect/authorizationV2/content/flows/login a bundle that is applicable
  to both mobile and desktop, being the guard to all other experiences

- client/connect/authorizationV2/content/flows/retail-channel-app a budnle holds
  the retail channel app experience, a mobile experience

- client/connect/authorizationV2/content/flows/business-channel-app a budnle
  holds the business channel app experience, a mobile experience

- client/connect/authorizationV2/content/flows/business-channel-web a budnle
  holds the business channel web experience, a desktop experience

- client/connect/authorizationV2/content/flows/legacy-app a budnle holds the
  legacy authentication app experience, a mobile experience

- client/connect/authorizationV2/content/flows/modern-desktop-app a budnle holds
  the modern authentication desktop app experience, a desktop experience

- client/connect/authorizationV2/content/flows/user-home-business the landing
  page for business users both mobile and desktop

- client/connect/authorizationV2/content/flows/user-home-retail the landing page
  for retail users mobile (currently no desktop experience)

the user-home-* are reached from the login experience
