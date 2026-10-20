import 'package:flutter_test/flutter_test.dart';
import 'package:educational_timetable_app/models/app_notification_model.dart';
import 'package:educational_timetable_app/screens/notifications_screen.dart';

void main() {
  group('notification UI helpers', () {
    test('admins and teachers can delete notifications', () {
      final adminNotif = AppNotification(
        id: '1',
        title: 'Title',
        message: 'Message',
        targetRole: 'all',
        senderId: 's1',
        senderName: 'Admin',
        senderRole: 'admin',
        createdAt: '2026-07-23',
      );
      final teacherNotif = AppNotification(
        id: '2',
        title: 'Title',
        message: 'Message',
        targetRole: 'all',
        senderId: 's2',
        senderName: 'Teacher',
        senderRole: 'teacher',
        createdAt: '2026-07-23',
      );

      // Admin can delete both
      expect(canDeleteNotification('admin', adminNotif), isTrue);
      expect(canDeleteNotification('admin', teacherNotif), isTrue);

      // Teacher can only delete their own teacher-created notifications, not admin-created
      expect(canDeleteNotification('teacher', adminNotif, userId: 's2'), isFalse);
      expect(canDeleteNotification('teacher', teacherNotif, userId: 's2'), isTrue);
      // Teacher cannot delete another teacher's notification
      expect(canDeleteNotification('teacher', teacherNotif, userId: 's3'), isFalse);

      // Student cannot delete either
      expect(canDeleteNotification('student', adminNotif), isFalse);
      expect(canDeleteNotification('student', teacherNotif), isFalse);

      // Null role cannot delete either
      expect(canDeleteNotification(null, adminNotif), isFalse);
      expect(canDeleteNotification(null, teacherNotif), isFalse);
    });

    test('unread notification count is calculated correctly', () {
      final notifications = [
        AppNotification(
          id: '1',
          title: 'First',
          message: 'first message',
          targetRole: 'all',
          senderId: 's1',
          senderName: 'Admin',
          createdAt: '2026-07-23',
          isRead: false,
        ),
        AppNotification(
          id: '2',
          title: 'Second',
          message: 'second message',
          targetRole: 'all',
          senderId: 's1',
          senderName: 'Admin',
          createdAt: '2026-07-23',
          isRead: true,
        ),
        AppNotification(
          id: '3',
          title: 'Third',
          message: 'third message',
          targetRole: 'all',
          senderId: 's1',
          senderName: 'Admin',
          createdAt: '2026-07-23',
          isRead: false,
        ),
      ];

      expect(countUnreadNotifications(notifications), 2);
    });
  });
}
