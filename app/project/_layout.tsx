import { Stack } from 'expo-router';

export default function ProjectLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="[id]/product/[productId]" />
      <Stack.Screen name="[id]/product/[productId]/item/[itemId]" />
      <Stack.Screen name="[id]/settings" />
    </Stack>
  );
}
