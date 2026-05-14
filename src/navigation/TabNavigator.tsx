import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";
import Animated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useTheme } from "../hooks/useTheme";
import { soundEngine } from "../services/soundEngine";
import { useAppStore } from "../store";

import { BudgetScreen } from "../screens/Budget";
import { DashboardScreen } from "../screens/Dashboard";
import { InsightsScreen } from "../screens/Insights";
import { ProfileScreen } from "../screens/Profile";
import { TransactionsNavigator } from "./TransactionsNavigator";

const AnimatedPager = Animated.createAnimatedComponent(PagerView);

const TabButton = ({ name, icon, label, active, onPress, colors }: any) => (
  <TouchableOpacity onPress={onPress} style={st.tabBtn}>
    <Ionicons
      name={active ? icon : `${icon}-outline`}
      size={24}
      color={active ? colors.primary : colors.textSecondary}
    />
    <Text
      style={[
        st.tabLabel,
        { color: active ? colors.primary : colors.textSecondary },
      ]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const AnimatedScreen = ({
  children,
  index,
  scrollOffset,
  swipeAnimation,
  width,
}: any) => {
  const animatedStyle = useAnimatedStyle(() => {
    if (swipeAnimation !== "cube") {
      return {
        opacity: 1,
        transform: [
          { perspective: 1000 },
          { translateX: 0 },
          { rotateY: "0deg" },
          { scale: 1 },
        ],
      };
    }

    const input = [index - 1, index, index + 1];
    const rotateY = interpolate(
      scrollOffset.value,
      input,
      [90, 0, -90],
      Extrapolate.CLAMP,
    );
    const translateX = interpolate(
      scrollOffset.value,
      input,
      [width / 2, 0, -width / 2],
      Extrapolate.CLAMP,
    );
    const scale = interpolate(
      scrollOffset.value,
      input,
      [0.8, 1, 0.8],
      Extrapolate.CLAMP,
    );
    const opacity = interpolate(
      scrollOffset.value,
      input,
      [0, 1, 0],
      Extrapolate.CLAMP,
    );

    return {
      transform: [
        { perspective: 1000 },
        { translateX },
        { rotateY: `${rotateY}deg` },
        { scale },
      ],
      opacity,
    };
  });

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      {children}
    </Animated.View>
  );
};

export const TabNavigator = () => {
  const { colors, spacing } = useTheme();
  const { swipeAnimation, swipeBehavior, activeTab, setActiveTab } =
    useAppStore();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<PagerView>(null);
  const scrollOffset = useSharedValue(0);

  const isInternalUpdate = useRef(false);
  const lastInteractionTime = useRef(0);
  const COOLDOWN_MS = 300;

  // Sync PagerView with global store
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastInteractionTime.current < COOLDOWN_MS) return;
    lastInteractionTime.current = now;

    pagerRef.current?.setPage(activeTab);
  }, [activeTab]);

  const screens = useMemo(
    () => [
      {
        name: "Dashboard",
        component: <DashboardScreen />,
        icon: "home",
        label: "Home",
      },
      {
        name: "Transactions",
        component: <TransactionsNavigator />,
        icon: "list",
        label: "Trans.",
      },
      {
        name: "Insights",
        component: <InsightsScreen />,
        icon: "pie-chart",
        label: "Insights",
      },
      {
        name: "Budget",
        component: <BudgetScreen />,
        icon: "wallet",
        label: "Budget",
      },
      {
        name: "Profile",
        component: <ProfileScreen />,
        icon: "person",
        label: "Profile",
      },
    ],
    [],
  );

  const onPageScroll = (e: any) => {
    "worklet";
    scrollOffset.value = e.nativeEvent.position + e.nativeEvent.offset;
  };

  const onPageSelected = (e: any) => {
    const newIdx = e.nativeEvent.position;
    const now = Date.now();
    
    if (now - lastInteractionTime.current < COOLDOWN_MS) return;
    lastInteractionTime.current = now;

    if (activeTab !== newIdx) {
      isInternalUpdate.current = true; // Block the useEffect from calling setPage again
      setActiveTab(newIdx);
    }
    
    soundEngine.play("swipe_glide");
  };

  const indicatorWidth = 50; // Fixed small width for a premium look
  const tabWidth = width / screens.length;

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          scrollOffset.value * tabWidth + (tabWidth - indicatorWidth) / 2,
      },
    ],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AnimatedPager
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageScroll={onPageScroll}
        onPageSelected={onPageSelected}
        overScrollMode="never"
        scrollEnabled={swipeBehavior === "screens"}
      >
        {screens.map((s, i) => (
          <View key={s.name} style={{ flex: 1 }}>
            <AnimatedScreen
              index={i}
              scrollOffset={scrollOffset}
              swipeAnimation={swipeAnimation}
              width={width}
            >
              {s.component}
            </AnimatedScreen>
          </View>
        ))}
      </AnimatedPager>

      <View
        style={[
          st.tabBar,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <Animated.View
          style={[
            st.indicator,
            {
              backgroundColor: colors.primary,
              width: indicatorWidth,
              height: 4,
              borderRadius: 2,
            },
            indicatorStyle,
          ]}
        />
        {screens.map((s, i) => (
          <TabButton
            key={s.name}
            active={activeTab === i}
            colors={colors}
            icon={s.icon}
            label={s.label}
            onPress={() => setActiveTab(i)}
          />
        ))}
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    height: 70,
    borderTopWidth: 1,
    paddingBottom: 10,
  },
  tabBtn: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 10, fontWeight: "700", marginTop: 4 },
  indicator: { position: "absolute", top: 0, height: 3, borderRadius: 3 },
});
