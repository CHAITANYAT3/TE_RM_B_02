# Kairos — Educational Timetable Management

Kairos is a cross-platform timetable management app for students, teachers, and administrators. It provides timetable and room availability views, faculty management, reminders, and notifications through a Flutter client and a Node.js API.

## Tech stack

- **Client:** Flutter and Dart
- **State management:** Provider
- **Backend:** Node.js, Express, and PostgreSQL
- **Authentication:** JWT and bcrypt
- **Notifications:** Firebase Cloud Messaging and local notifications
- **Platforms:** Android, iOS, web, Windows, macOS, and Linux (subject to platform-specific setup)

## Features

- Role-based student, teacher, and administrator experiences
- Timetable viewing, building, and upload workflows
- Room and faculty availability management
- Lecture reminders and notifications
- Faculty management tools

## Repository layout

```text
lib/        Flutter app, screens, models, providers, and services
backend/    Express API
test/       Flutter tests
android/    Android project configuration
ios/        iOS project configuration
web/        Web app configuration
```

## Requirements

- Flutter SDK and Dart SDK compatible with the constraints in `pubspec.yaml`
- Node.js and npm to run the backend
- A PostgreSQL database for the backend
- Firebase configuration for push notifications

## Run the Flutter app

From the repository root:

```sh
flutter pub get
flutter run
```

Run the widget tests with:

```sh
flutter test
```

The API base URL is configured in `lib/services/api_service.dart`. Point it at your backend when running against a local server. Firebase platform configuration may also be required for the target device.

## Run the backend

From the `backend` directory:

```sh
npm install
npm start
```

Configure the backend environment before starting it:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — strong, private signing secret
- `FIREBASE_SERVICE_ACCOUNT` — Firebase Admin service-account JSON, when using the environment-based option

Alternatively, the backend can load a local `firebase-service-account.json`. Keep that file and all environment files private; do not commit credentials. The app currently uses a hosted API URL by default, so update its API base URL if you want the client to use your local backend.

There are no built-in demo login accounts. Create users through the registration flow; do not add real passwords or account credentials to source code.

## Notifications and Firebase

Firebase client options are in `lib/firebase_options.dart`. Configure Firebase for each platform you intend to run, following the official [FlutterFire setup guide](https://firebase.google.com/docs/flutter/setup). Push notifications also require valid Firebase Admin credentials in the backend environment.
