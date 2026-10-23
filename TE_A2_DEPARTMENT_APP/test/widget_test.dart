import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:educational_timetable_app/main.dart';

void main() {
  testWidgets('Welcome screen loads and shows login button', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const MyApp());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Get Started / Login'), findsOneWidget);
    expect(find.text('Kairos'), findsWidgets);
  });
}