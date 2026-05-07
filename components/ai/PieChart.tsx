import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';

interface PieChartProps {
  data: {
    percentage: number;
    color: string;
  }[];
  size?: number;
  strokeWidth?: number;
}

export default function PieChart({ data, size = 160, strokeWidth = 30 }: PieChartProps) {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  
  let currentAngle = -90; // Inizia dall'alto

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <G>
          {data.map((item, index) => {
            if (item.percentage <= 0) return null;
            
            const angle = (item.percentage / 100) * 360;
            const startAngle = currentAngle;
            currentAngle += angle;

            // Calcolo coordinate arco
            const x1 = center + radius * Math.cos((Math.PI * startAngle) / 180);
            const y1 = center + radius * Math.sin((Math.PI * startAngle) / 180);
            const x2 = center + radius * Math.cos((Math.PI * currentAngle) / 180);
            const y2 = center + radius * Math.sin((Math.PI * currentAngle) / 180);

            const largeArcFlag = angle > 180 ? 1 : 0;

            const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

            return (
              <Path
                key={index}
                d={d}
                stroke={item.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
          {/* Cerchio centrale per effetto "Donut" se necessario, o per pulizia */}
          {data.length === 0 && (
            <Circle cx={center} cy={center} r={radius} stroke="#E5E7EB" strokeWidth={strokeWidth} fill="none" />
          )}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
