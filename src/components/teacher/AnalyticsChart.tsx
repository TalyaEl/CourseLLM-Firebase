'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { ANALYTICS_DATA } from '@/lib/data';

const chartConfig = {
  mastery: {
    label: 'Mastery',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export function AnalyticsChart() {
  return (
    <div className="h-[400px] w-full">
        <ChartContainer config={chartConfig} className="w-full h-full">
        <ResponsiveContainer>
            <BarChart data={ANALYTICS_DATA} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey="topic"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                />
                <YAxis
                    tickFormatter={(value) => `${value}%`}
                />
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                />
                <Bar dataKey="mastery" fill="var(--color-mastery)" radius={4} />
            </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
    </div>
  );
}
