declare module 'expo/ui/menu' {
  import React from 'react';

  export const Root: React.FC<{ children: React.ReactNode }>;
  
  export const Trigger: React.FC<{ children: React.ReactNode }>;
  
  export const Content: React.FC<{ children: React.ReactNode }>;
  
  export interface MenuItemProps {
    id: string;
    title: string;
    role?: 'default' | 'destructive' | 'cancel' | string;
    onSelect?: () => void;
  }
  
  export const Item: React.FC<MenuItemProps>;
}
