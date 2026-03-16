# Functional Specification: Business Account Enrollment

## 1. Overview
The Business Account Enrollment process is a multi-step workflow designed to allow authorized users to initiate the opening of a new business bank account for an existing member under a specific license. This process culminates in the creation of a legally binding signing case.

## 2. Target Audience & Roles
Access to this process is restricted based on the following roles:
- **Administrators**: Users with full management capabilities.
- **Legal Representatives (LEGALREPS)**: Authorized signatories for the organization.

## 3. Core Process Flow (Wizard)
The enrollment is implemented as a 3-step wizard to ensure data accuracy and user clarity.

### Step 1: Account Owner Selection
- **Objective**: Identify the legal entity (License Member) for which the account will be opened.
- **Input**: User selects a "License Member" from a pre-filtered list based on the active license.
- **Constraints**: The list is dynamically populated based on the user's current environment/license context.

### Step 2: Account Signee Selection
- **Objective**: Identify the individual (Fellow) who will act as the signee for the account.
- **Input**: User selects an "Account Signee" from a list of individuals.
- **Dependencies**: The list of available signees is dynamically filtered based on the "Account Owner" selected in Step 1.

### Step 3: Order Summary & Execution
- **Objective**: Review the configuration and initiate the account opening.
- **Display**: A summary of selected values:
    - Target License ID
    - Selected Account Owner (Member)
    - Selected Account Signee (Fellow / Holder)
- **Primary Action**: "Place Order"
- **Result**: Initiation of the backend fulfillment process (Case Creation).

## 4. Functional Requirements

### 4.1 Data Validation
- Users cannot progress to Step 2 without selecting an Account Owner.
- Users cannot submit the order without selecting an Account Signee.

### 4.2 Dynamic Data Filtering
- The system must support "cascading dropdowns" or equivalent logic where the selection in Step 1 strictly limits the valid options in Step 2.

### 4.3 Persistence of Intent
- The system must create a "Signing Case" upon submission.
- The case must follow a **Joint Signature** strategy, requiring authorization from both the Company's Legal Representatives and the individual signee.

### 4.4 User Feedback
- Upon successful submission, a confirmation message must be displayed to the user.
- The system must provide an automatic navigation (Redirection) to the management view of the newly created case to allow for immediate next steps.

## 5. Metadata Definitions
| Property | Type | Description |
| :--- | :--- | :--- |
| Product | String | Fixed: "Business Bank Account" |
| Status | String | Initial State: "Draft" |
| Member ID | Reference | Internal identifier of the legal entity. |
| Signee ID | Reference | Internal identifier of the individual card holder. |

## 6. Integration Requirements
- **Case Management System**: The flow must integrate with a Case Management service to register a new authorization request.
- **Context Management**: The flow requires access to the currently active license and session context to populate options.
