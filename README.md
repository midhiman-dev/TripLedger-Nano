# TripLedger-Nano 🚀

TripLedger-Nano is a sophisticated, precision-engineered travel expense tracker designed for modern travelers who demand clarity and insight into their journey spending. Built with a focus on Material 3 design principles and real-time analytics, it transforms raw spending data into actionable travel intelligence.

## ✨ Key Features

### 🔐 Secure & Personal
*   **Google OAuth Integration**: Securely sign in using your Google account to keep your travel data private and synced across devices.
*   **Real-time Persistence**: All data is stored in Firebase Firestore, ensuring your ledgers are always up-to-date.

### 📊 Intelligent Budgeting & Forecasting
*   **Category-Based Budgets**: Set specific spending limits for Accommodation, Transport, Food & Activities, Shopping, and Miscellaneous.
*   **Burn-Rate Forecasting**: Our projection engine calculates your "Daily Average" and "Projected Total" based on current spending patterns.
*   **RAG Risk Status**: Instant visual feedback (Red-Amber-Green) tells you if you're on track or at risk of overspending in any category.
*   **Smart Accommodation Logic**: Intelligent handling of fixed costs; accommodation is averaged over the total trip duration to prevent false "over-budget" alarms.

### 💸 Precision Tracking
*   **Detailed Log Entry**: Record amount (INR), category, date, and notes for every expense.
*   **Dynamic Payment Sources**: Track payments via Cash, UPI, Credit Card, or Netbanking.
*   **Custom Sources**: Add your own payment methods (e.g., "Forex Card", "Digital Wallet") in User Settings.

### 📄 Professional Reporting
*   **PDF Export**: Generate comprehensive Trip Summary Reports with a single tap.
*   **Spending summaries**: Includes detailed expense lists, forecast projections, and a "Spending by Source" summary.

### 🛠 User Experience
*   **Mobile-First Design**: A sleek, thumb-friendly interface optimized for travelers on the move.
*   **Trip Archiving**: Keep your dashboard clean by archiving completed journeys while keeping their data accessible for future reference.
*   **Contextual Images**: Dynamic hero images based on your trip destination.

## 🚀 Getting Started

### Prerequisites
*   Node.js (LTS recommended)
*   A Firebase project with Firestore and Google Authentication enabled.

### Installation

1.  **Clone & Install**:
    ```bash
    npm install
    ```

2.  **Environment Setup**:
    Create a `.env` file based on `.env.example` and provide your Firebase configuration and Gemini API Key.

3.  **Local Development**:
    ```bash
    npm run dev
    ```

4.  **Production Build**:
    ```bash
    npm run build
    ```

## 🏗 Technology Stack
*   **Framework**: React 18 + Vite
*   **Styling**: Tailwind CSS
*   **Database & Auth**: Firebase (Firestore & Google Auth)
*   **Animations**: Framer Motion
*   **Icons**: Lucide React
*   **Reporting**: jsPDF & AutoTable

## 📝 License
This project is licensed under the Apache-2.0 License.
