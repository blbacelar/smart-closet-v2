jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('lucide-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Icon = (props) => React.createElement(View, props);

  return {
    ArrowRight: Icon,
    Camera: Icon,
    Check: Icon,
    Eye: Icon,
    Gift: Icon,
    ImagePlus: Icon,
    Lock: Icon,
    MapPin: Icon,
    Palette: Icon,
    Plus: Icon,
    RefreshCw: Icon,
    RotateCcw: Icon,
    Ruler: Icon,
    Sparkles: Icon,
    Tag: Icon,
    ThumbsDown: Icon,
    ThumbsUp: Icon,
    Trash2: Icon,
    X: Icon,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');

  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
