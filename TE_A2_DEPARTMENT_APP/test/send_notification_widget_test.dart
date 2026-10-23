import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:educational_timetable_app/models/user_model.dart';
import 'package:educational_timetable_app/providers/auth_provider.dart';
import 'package:educational_timetable_app/screens/send_notification_screen.dart';
import 'package:educational_timetable_app/services/api_service.dart';

class FakeAuthProvider extends ChangeNotifier implements AuthProvider {
  final User? _user;
  FakeAuthProvider(this._user);

  @override
  User? get user => _user;

  @override
  bool get isLoggedIn => _user != null;

  @override
  bool get isCheckingStatus => false;

  @override
  bool get isLoading => false;

  @override
  String? get error => null;

  @override
  Future<Map<String, dynamic>> login({required String emailOrUsername, required String password, required String role}) {
    throw UnimplementedError();
  }

  @override
  Future<void> logout() async {}

  @override
  Future<Map<String, dynamic>> register({required String emailOrUsername, required String name, required String password, required String role, String? className, String? section, String? specialization, String? college, String? phone}) {
    throw UnimplementedError();
  }

  @override
  Future<Map<String, dynamic>> recoverAccount(String email, String password) {
    throw UnimplementedError();
  }

  @override
  Future<void> updateTeacherProfile({required String name, required String email, required String college}) {
    throw UnimplementedError();
  }

  @override
  Future<void> updateUserProfile({required String name, required String email, required String className, required String section, required String specialization, required String college}) {
    throw UnimplementedError();
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  Future<void> pumpSendNotificationScreen(WidgetTester tester) async {
    tester.binding.window.physicalSizeTestValue = const Size(1200, 2400);
    tester.binding.window.devicePixelRatioTestValue = 1.0;
    addTearDown(() {
      tester.binding.window.clearPhysicalSizeTestValue();
      tester.binding.window.clearDevicePixelRatioTestValue();
      ApiService.resetScheduleNotificationHandler();
    });

    ApiService.scheduleNotificationHandler = ({
      required String lectureId,
      required String title,
      required String message,
      required String notificationType,
      required String className,
      required String section,
      String? college,
      required String scheduledAt,
      String? targetDivision,
    }) async {
      return {'success': true, 'message': 'ok'};
    };

    final authData = User(
      id: 'T1',
      username: 'teacher1',
      name: 'Teacher One',
      email: 't1@college.edu',
      role: 'teacher',
      token: 'local-token-t1',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ChangeNotifierProvider<AuthProvider>.value(
          value: FakeAuthProvider(authData),
          child: const SendNotificationScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle(const Duration(seconds: 1));
  }

  testWidgets('confirmation dialog and backend-failure fallback shows saved locally', (WidgetTester tester) async {
    await pumpSendNotificationScreen(tester);

    expect(find.text('Access Denied'), findsNothing);
    await tester.enterText(find.byKey(const Key('notificationTitleField')), 'Test Title');
    await tester.enterText(find.byKey(const Key('notificationMessageField')), 'Test Message');

    final sendButton = find.byKey(const Key('sendNotificationSubmit'));
    expect(sendButton, findsOneWidget);

    await tester.ensureVisible(sendButton);
    await tester.pumpAndSettle();
    await tester.tap(sendButton);
    await tester.pumpAndSettle();

    expect(find.text('Confirm Send'), findsOneWidget);

    final alertSendButton = find.byKey(const Key('confirmSendDialogButton'));
    await tester.tap(alertSendButton);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets('cancelling confirmation does not send', (WidgetTester tester) async {
    await pumpSendNotificationScreen(tester);

    expect(find.text('Access Denied'), findsNothing);
    await tester.enterText(find.byKey(const Key('notificationTitleField')), 'Test Title');
    await tester.enterText(find.byKey(const Key('notificationMessageField')), 'Test Message');

    final sendButton = find.byKey(const Key('sendNotificationSubmit'));
    expect(sendButton, findsOneWidget);

    await tester.ensureVisible(sendButton);
    await tester.pumpAndSettle();
    await tester.tap(sendButton);
    await tester.pumpAndSettle();

    expect(find.text('Confirm Send'), findsOneWidget);

    final cancelButton = find.byKey(const Key('cancelSendDialogButton'));
    await tester.tap(cancelButton);
    await tester.pumpAndSettle();

    expect(find.text('Confirm Send'), findsNothing);
    expect(find.textContaining('Saved locally.'), findsNothing);
  });
}
