import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/icon.png";

interface AppHeaderProps {
  generations: number;
  session: {
    user: {
      id: string;
      email: string;
      emailVerified: boolean;
      name: string;
      createdAt: Date;
      updatedAt: Date;
      image?: string | null | undefined;
    };
    session: {
      id: string;
      userId: string;
      expiresAt: Date;
      createdAt: Date;
      updatedAt: Date;
      token: string;
      ipAddress?: string | null | undefined;
      userAgent?: string | null | undefined;
    };
  };
  onSignOut: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  generations,
  session,
  onSignOut,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/30 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 p-2 bg-black rounded-full flex items-center justify-center">
          <img
            src={logo}
            className="text-xs font-bold text-primary-foreground object-cover"
            alt="n8nGPT Logo"
          />
        </div>
        <span className="text-sm font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
          n8nGPT
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Badge
          variant="secondary"
          className="font-normal text-primary border-primary border-1 transition-colors duration-200"
        >
          {generations}/100 Gens
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger className="cursor-pointer">
            <Avatar>
              {session?.user?.image && (
                <AvatarImage src={session?.user?.image} />
              )}
              <AvatarFallback>
                {session?.user?.name?.slice(0, 2) || "ME"}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="cursor-pointer" onClick={onSignOut}>
              Sign out
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
