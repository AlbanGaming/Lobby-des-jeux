import pygame
import random
import math
import json
import os

# Initialisation de Pygame
pygame.init()
pygame.mixer.init()

# Constantes
WIDTH, HEIGHT = 1200, 800
FPS = 60

# Couleurs
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 100, 255)
YELLOW = (255, 255, 0)
PURPLE = (150, 0, 255)
CYAN = (0, 255, 255)
ORANGE = (255, 165, 0)

class Particle:
    """Particules pour les effets visuels"""
    def __init__(self, x, y, color, velocity=None):
        self.x = x
        self.y = y
        self.color = color
        self.size = random.randint(2, 5)
        self.lifetime = random.randint(20, 40)
        if velocity:
            self.vx, self.vy = velocity
        else:
            angle = random.uniform(0, math.pi * 2)
            speed = random.uniform(2, 6)
            self.vx = math.cos(angle) * speed
            self.vy = math.sin(angle) * speed
        
    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.vy += 0.3  # Gravité
        self.lifetime -= 1
        self.size = max(1, self.size - 0.1)
        
    def draw(self, screen):
        if self.lifetime > 0:
            alpha = int(255 * (self.lifetime / 40))
            color_with_alpha = (*self.color, alpha)
            pygame.draw.circle(screen, self.color, (int(self.x), int(self.y)), int(self.size))

class Star:
    """Étoiles en arrière-plan"""
    def __init__(self):
        self.x = random.randint(0, WIDTH)
        self.y = random.randint(0, HEIGHT)
        self.speed = random.uniform(0.5, 3)
        self.size = random.randint(1, 3)
        self.brightness = random.randint(100, 255)
        
    def update(self):
        self.y += self.speed
        if self.y > HEIGHT:
            self.y = 0
            self.x = random.randint(0, WIDTH)
            
    def draw(self, screen):
        color = (self.brightness, self.brightness, self.brightness)
        pygame.draw.circle(screen, color, (int(self.x), int(self.y)), self.size)

class Player:
    """Vaisseau du joueur"""
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.width = 40
        self.height = 50
        self.speed = 7
        self.health = 100
        self.max_health = 100
        self.shield = 0
        self.max_shield = 50
        self.lives = 3
        self.score = 0
        self.level = 1
        self.experience = 0
        self.weapon_level = 1
        self.fire_rate = 10
        self.fire_cooldown = 0
        self.invulnerable = 0
        self.power_up_duration = 0
        self.rapid_fire = False
        self.trail = []
        
    def move(self, keys):
        if keys[pygame.K_LEFT] or keys[pygame.K_a]:
            self.x = max(0, self.x - self.speed)
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
            self.x = min(WIDTH - self.width, self.x + self.speed)
        if keys[pygame.K_UP] or keys[pygame.K_w]:
            self.y = max(0, self.y - self.speed)
        if keys[pygame.K_DOWN] or keys[pygame.K_s]:
            self.y = min(HEIGHT - self.height, self.y + self.speed)
            
        # Traînée du vaisseau
        self.trail.append((self.x + self.width // 2, self.y + self.height))
        if len(self.trail) > 15:
            self.trail.pop(0)
            
    def shoot(self):
        if self.fire_cooldown == 0:
            bullets = []
            
            if self.weapon_level == 1:
                bullets.append(Bullet(self.x + self.width // 2, self.y, 0))
            elif self.weapon_level == 2:
                bullets.append(Bullet(self.x + self.width // 2 - 10, self.y, 0))
                bullets.append(Bullet(self.x + self.width // 2 + 10, self.y, 0))
            elif self.weapon_level >= 3:
                bullets.append(Bullet(self.x + self.width // 2, self.y, 0))
                bullets.append(Bullet(self.x + self.width // 2 - 15, self.y, -0.3))
                bullets.append(Bullet(self.x + self.width // 2 + 15, self.y, 0.3))
                
            self.fire_cooldown = self.fire_rate if not self.rapid_fire else self.fire_rate // 2
            return bullets
        return []
        
    def update(self):
        if self.fire_cooldown > 0:
            self.fire_cooldown -= 1
        if self.invulnerable > 0:
            self.invulnerable -= 1
        if self.power_up_duration > 0:
            self.power_up_duration -= 1
            if self.power_up_duration == 0:
                self.rapid_fire = False
                
        # Régénération du bouclier
        if self.shield < self.max_shield:
            self.shield = min(self.max_shield, self.shield + 0.05)
            
    def take_damage(self, damage):
        if self.invulnerable > 0:
            return False
            
        if self.shield > 0:
            self.shield = max(0, self.shield - damage)
            if self.shield == 0:
                damage = damage - self.shield
            else:
                return False
                
        self.health -= damage
        if self.health <= 0:
            self.lives -= 1
            if self.lives > 0:
                self.health = self.max_health
                self.shield = self.max_shield
                self.invulnerable = 180
                return False
            return True
        return False
        
    def add_experience(self, exp):
        self.experience += exp
        exp_needed = self.level * 100
        if self.experience >= exp_needed:
            self.level_up()
            
    def level_up(self):
        self.level += 1
        self.experience = 0
        self.max_health += 20
        self.health = self.max_health
        self.max_shield += 10
        self.shield = self.max_shield
        
        if self.level % 3 == 0:
            self.weapon_level = min(3, self.weapon_level + 1)
            
    def draw(self, screen):
        # Traînée
        for i, pos in enumerate(self.trail):
            alpha = int(255 * (i / len(self.trail)))
            size = int(3 * (i / len(self.trail)))
            color = (0, 150 + int(105 * (i / len(self.trail))), 255)
            pygame.draw.circle(screen, color, pos, size)
        
        # Corps du vaisseau
        if self.invulnerable > 0 and (self.invulnerable // 5) % 2 == 0:
            return  # Clignotement
            
        # Forme du vaisseau
        points = [
            (self.x + self.width // 2, self.y),  # Pointe
            (self.x, self.y + self.height),  # Bas gauche
            (self.x + self.width // 2, self.y + self.height - 10),  # Centre bas
            (self.x + self.width, self.y + self.height),  # Bas droit
        ]
        
        # Couleur selon le niveau
        if self.weapon_level == 1:
            ship_color = CYAN
        elif self.weapon_level == 2:
            ship_color = (0, 255, 100)
        else:
            ship_color = PURPLE
            
        pygame.draw.polygon(screen, ship_color, points)
        pygame.draw.polygon(screen, WHITE, points, 2)
        
        # Cockpit
        pygame.draw.circle(screen, YELLOW, (self.x + self.width // 2, self.y + 15), 5)
        
        # Réacteurs
        flame_color = ORANGE if pygame.time.get_ticks() % 200 < 100 else RED
        pygame.draw.circle(screen, flame_color, (self.x + 8, self.y + self.height), 4)
        pygame.draw.circle(screen, flame_color, (self.x + self.width - 8, self.y + self.height), 4)

class Bullet:
    """Projectile du joueur"""
    def __init__(self, x, y, angle=0):
        self.x = x
        self.y = y
        self.speed = 12
        self.width = 4
        self.height = 15
        self.damage = 20
        self.angle = angle
        
    def update(self):
        self.y -= self.speed
        self.x += self.angle * 10
        
    def draw(self, screen):
        # Effet lumineux
        pygame.draw.circle(screen, CYAN, (int(self.x), int(self.y)), 6, 2)
        pygame.draw.circle(screen, WHITE, (int(self.x), int(self.y)), 3)

class Enemy:
    """Ennemi de base"""
    def __init__(self, x, y, enemy_type=1):
        self.x = x
        self.y = y
        self.type = enemy_type
        self.width = 30 + enemy_type * 10
        self.height = 30 + enemy_type * 10
        self.speed = 2 + random.uniform(-0.5, 0.5)
        self.health = 50 * enemy_type
        self.max_health = self.health
        self.score_value = 10 * enemy_type
        self.exp_value = 5 * enemy_type
        self.shoot_cooldown = random.randint(60, 120)
        self.move_pattern = random.choice(['straight', 'sine', 'zigzag'])
        self.pattern_offset = random.uniform(0, math.pi * 2)
        self.frame = 0
        
    def update(self):
        self.frame += 1
        self.shoot_cooldown -= 1
        
        # Patterns de mouvement
        if self.move_pattern == 'straight':
            self.y += self.speed
        elif self.move_pattern == 'sine':
            self.y += self.speed
            self.x += math.sin(self.frame * 0.05 + self.pattern_offset) * 2
        elif self.move_pattern == 'zigzag':
            self.y += self.speed
            self.x += math.cos(self.frame * 0.1 + self.pattern_offset) * 3
            
    def shoot(self):
        if self.shoot_cooldown <= 0:
            self.shoot_cooldown = random.randint(60, 120)
            return EnemyBullet(self.x + self.width // 2, self.y + self.height)
        return None
        
    def take_damage(self, damage):
        self.health -= damage
        return self.health <= 0
        
    def draw(self, screen):
        # Corps de l'ennemi
        if self.type == 1:
            color = RED
        elif self.type == 2:
            color = ORANGE
        else:
            color = PURPLE
            
        # Forme hexagonale
        points = []
        for i in range(6):
            angle = math.pi / 3 * i
            px = self.x + self.width // 2 + math.cos(angle) * self.width // 2
            py = self.y + self.height // 2 + math.sin(angle) * self.height // 2
            points.append((px, py))
            
        pygame.draw.polygon(screen, color, points)
        pygame.draw.polygon(screen, WHITE, points, 2)
        
        # Barre de vie
        health_ratio = self.health / self.max_health
        health_bar_width = self.width
        health_bar_height = 5
        pygame.draw.rect(screen, RED, (self.x, self.y - 10, health_bar_width, health_bar_height))
        pygame.draw.rect(screen, GREEN, (self.x, self.y - 10, health_bar_width * health_ratio, health_bar_height))

class Boss(Enemy):
    """Boss ennemi"""
    def __init__(self, x, y):
        super().__init__(x, y, 5)
        self.width = 120
        self.height = 120
        self.health = 1000
        self.max_health = 1000
        self.score_value = 500
        self.exp_value = 200
        self.phase = 1
        self.attack_pattern = 0
        self.attack_cooldown = 0
        
    def update(self):
        self.frame += 1
        self.attack_cooldown -= 1
        
        # Mouvement du boss
        if self.y < 100:
            self.y += 1
        else:
            self.x += math.sin(self.frame * 0.02) * 2
            
        # Changement de phase
        if self.health < self.max_health * 0.5 and self.phase == 1:
            self.phase = 2
            self.speed += 1
            
    def shoot(self):
        bullets = []
        if self.attack_cooldown <= 0:
            self.attack_cooldown = 30
            
            # Pattern circulaire
            if self.attack_pattern == 0:
                for i in range(8):
                    angle = (math.pi * 2 / 8) * i
                    bullets.append(EnemyBullet(
                        self.x + self.width // 2,
                        self.y + self.height // 2,
                        angle
                    ))
            # Pattern en spirale
            elif self.attack_pattern == 1:
                for i in range(3):
                    angle = (self.frame * 0.1) + (math.pi * 2 / 3) * i
                    bullets.append(EnemyBullet(
                        self.x + self.width // 2,
                        self.y + self.height // 2,
                        angle
                    ))
                    
            self.attack_pattern = (self.attack_pattern + 1) % 2
            
        return bullets
        
    def draw(self, screen):
        # Corps du boss
        color = (150, 0, 255) if self.phase == 1 else (255, 0, 150)
        
        # Forme en étoile
        points = []
        for i in range(8):
            angle = (math.pi / 4) * i
            if i % 2 == 0:
                radius = self.width // 2
            else:
                radius = self.width // 3
            px = self.x + self.width // 2 + math.cos(angle) * radius
            py = self.y + self.height // 2 + math.sin(angle) * radius
            points.append((px, py))
            
        pygame.draw.polygon(screen, color, points)
        pygame.draw.polygon(screen, WHITE, points, 3)
        
        # Œil central
        eye_pulse = abs(math.sin(self.frame * 0.1)) * 10
        pygame.draw.circle(screen, RED, (int(self.x + self.width // 2), int(self.y + self.height // 2)), int(20 + eye_pulse))
        pygame.draw.circle(screen, YELLOW, (int(self.x + self.width // 2), int(self.y + self.height // 2)), int(10 + eye_pulse))
        
        # Barre de vie
        health_ratio = self.health / self.max_health
        bar_width = 200
        bar_height = 20
        bar_x = WIDTH // 2 - bar_width // 2
        bar_y = 20
        
        pygame.draw.rect(screen, RED, (bar_x, bar_y, bar_width, bar_height))
        pygame.draw.rect(screen, GREEN, (bar_x, bar_y, bar_width * health_ratio, bar_height))
        pygame.draw.rect(screen, WHITE, (bar_x, bar_y, bar_width, bar_height), 2)

class EnemyBullet:
    """Projectile ennemi"""
    def __init__(self, x, y, angle=None):
        self.x = x
        self.y = y
        self.speed = 5
        self.damage = 10
        if angle is None:
            self.vx = 0
            self.vy = self.speed
        else:
            self.vx = math.cos(angle) * self.speed
            self.vy = math.sin(angle) * self.speed
        
    def update(self):
        self.x += self.vx
        self.y += self.vy
        
    def draw(self, screen):
        pygame.draw.circle(screen, RED, (int(self.x), int(self.y)), 5)
        pygame.draw.circle(screen, ORANGE, (int(self.x), int(self.y)), 3)

class PowerUp:
    """Power-up"""
    def __init__(self, x, y, power_type):
        self.x = x
        self.y = y
        self.width = 30
        self.height = 30
        self.type = power_type  # 'health', 'shield', 'weapon', 'rapid_fire'
        self.speed = 2
        self.frame = 0
        
    def update(self):
        self.y += self.speed
        self.frame += 1
        
    def draw(self, screen):
        # Effet de rotation
        pulse = abs(math.sin(self.frame * 0.1)) * 5
        
        if self.type == 'health':
            color = GREEN
            pygame.draw.rect(screen, color, (self.x - 2, self.y + 10, 20, 5))
            pygame.draw.rect(screen, color, (self.x + 7, self.y, 5, 25))
        elif self.type == 'shield':
            color = CYAN
            pygame.draw.circle(screen, color, (int(self.x + 10), int(self.y + 10)), int(15 + pulse), 3)
        elif self.type == 'weapon':
            color = PURPLE
            pygame.draw.polygon(screen, color, [
                (self.x + 10, self.y),
                (self.x, self.y + 20),
                (self.x + 20, self.y + 20)
            ])
        elif self.type == 'rapid_fire':
            color = ORANGE
            for i in range(3):
                pygame.draw.circle(screen, color, (int(self.x + 10), int(self.y + i * 8)), 3)

class Game:
    """Classe principale du jeu"""
    def __init__(self):
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("🚀 COSMIC DEFENDER 🚀")
        self.clock = pygame.time.Clock()
        self.running = True
        self.game_state = 'menu'  # 'menu', 'playing', 'paused', 'game_over'
        
        # Police
        self.font_large = pygame.font.Font(None, 72)
        self.font_medium = pygame.font.Font(None, 48)
        self.font_small = pygame.font.Font(None, 32)
        self.font_tiny = pygame.font.Font(None, 24)
        
        # Éléments du jeu
        self.player = Player(WIDTH // 2 - 20, HEIGHT - 100)
        self.bullets = []
        self.enemies = []
        self.enemy_bullets = []
        self.power_ups = []
        self.particles = []
        self.stars = [Star() for _ in range(100)]
        
        # Spawn
        self.enemy_spawn_timer = 0
        self.enemy_spawn_rate = 60
        self.wave = 1
        self.boss_spawned = False
        self.boss = None
        
        # High score
        self.high_score = self.load_high_score()
        
    def load_high_score(self):
        try:
            if os.path.exists('high_score.json'):
                with open('high_score.json', 'r') as f:
                    data = json.load(f)
                    return data.get('high_score', 0)
        except:
            pass
        return 0
        
    def save_high_score(self):
        try:
            with open('high_score.json', 'w') as f:
                json.dump({'high_score': self.high_score}, f)
        except:
            pass
            
    def reset_game(self):
        self.player = Player(WIDTH // 2 - 20, HEIGHT - 100)
        self.bullets = []
        self.enemies = []
        self.enemy_bullets = []
        self.power_ups = []
        self.particles = []
        self.enemy_spawn_timer = 0
        self.wave = 1
        self.boss_spawned = False
        self.boss = None
        
    def spawn_enemy(self):
        x = random.randint(50, WIDTH - 50)
        y = -50
        enemy_type = random.choices([1, 2, 3], weights=[60, 30, 10])[0]
        self.enemies.append(Enemy(x, y, enemy_type))
        
    def spawn_boss(self):
        if not self.boss_spawned:
            self.boss = Boss(WIDTH // 2 - 60, -150)
            self.boss_spawned = True
            
    def spawn_power_up(self, x, y):
        if random.random() < 0.3:
            power_type = random.choice(['health', 'shield', 'weapon', 'rapid_fire'])
            self.power_ups.append(PowerUp(x, y, power_type))
            
    def handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
                
            if event.type == pygame.KEYDOWN:
                if self.game_state == 'menu':
                    if event.key == pygame.K_SPACE or event.key == pygame.K_RETURN:
                        self.game_state = 'playing'
                        self.reset_game()
                    elif event.key == pygame.K_ESCAPE:
                        self.running = False
                        
                elif self.game_state == 'playing':
                    if event.key == pygame.K_ESCAPE or event.key == pygame.K_p:
                        self.game_state = 'paused'
                        
                elif self.game_state == 'paused':
                    if event.key == pygame.K_ESCAPE or event.key == pygame.K_p:
                        self.game_state = 'playing'
                    elif event.key == pygame.K_m:
                        self.game_state = 'menu'
                        
                elif self.game_state == 'game_over':
                    if event.key == pygame.K_SPACE or event.key == pygame.K_RETURN:
                        self.game_state = 'playing'
                        self.reset_game()
                    elif event.key == pygame.K_m:
                        self.game_state = 'menu'
                        
    def update(self):
        if self.game_state != 'playing':
            return
            
        # Mise à jour des étoiles
        for star in self.stars:
            star.update()
            
        # Mise à jour du joueur
        keys = pygame.key.get_pressed()
        self.player.move(keys)
        self.player.update()
        
        if keys[pygame.K_SPACE]:
            new_bullets = self.player.shoot()
            self.bullets.extend(new_bullets)
            
        # Mise à jour des balles
        for bullet in self.bullets[:]:
            bullet.update()
            if bullet.y < 0 or bullet.x < 0 or bullet.x > WIDTH:
                self.bullets.remove(bullet)
                
        # Spawn des ennemis
        self.enemy_spawn_timer += 1
        if self.enemy_spawn_timer >= self.enemy_spawn_rate:
            self.spawn_enemy()
            self.enemy_spawn_timer = 0
            
        # Boss tous les 5 vagues
        if self.player.score > self.wave * 500 and not self.boss_spawned:
            self.spawn_boss()
            self.wave += 1
            
        # Mise à jour du boss
        if self.boss:
            self.boss.update()
            boss_bullets = self.boss.shoot()
            if boss_bullets:
                self.enemy_bullets.extend(boss_bullets)
                
            # Collision boss avec balles
            for bullet in self.bullets[:]:
                if (self.boss.x < bullet.x < self.boss.x + self.boss.width and
                    self.boss.y < bullet.y < self.boss.y + self.boss.height):
                    if self.boss.take_damage(bullet.damage):
                        # Boss détruit
                        for _ in range(50):
                            self.particles.append(Particle(
                                self.boss.x + self.boss.width // 2,
                                self.boss.y + self.boss.height // 2,
                                random.choice([RED, ORANGE, YELLOW, PURPLE])
                            ))
                        self.player.score += self.boss.score_value
                        self.player.add_experience(self.boss.exp_value)
                        self.spawn_power_up(self.boss.x + self.boss.width // 2, self.boss.y + self.boss.height // 2)
                        self.boss = None
                        self.boss_spawned = False
                    else:
                        for _ in range(5):
                            self.particles.append(Particle(bullet.x, bullet.y, CYAN))
                    self.bullets.remove(bullet)
                    
            if self.boss and self.boss.y > HEIGHT:
                self.boss = None
                self.boss_spawned = False
                
        # Mise à jour des ennemis
        for enemy in self.enemies[:]:
            enemy.update()
            
            # Tir ennemi
            enemy_bullet = enemy.shoot()
            if enemy_bullet:
                self.enemy_bullets.append(enemy_bullet)
                
            # Collision avec les balles
            for bullet in self.bullets[:]:
                if (enemy.x < bullet.x < enemy.x + enemy.width and
                    enemy.y < bullet.y < enemy.y + enemy.height):
                    if enemy.take_damage(bullet.damage):
                        # Ennemi détruit
                        for _ in range(10):
                            self.particles.append(Particle(enemy.x + enemy.width // 2, enemy.y + enemy.height // 2, RED))
                        self.player.score += enemy.score_value
                        self.player.add_experience(enemy.exp_value)
                        self.spawn_power_up(enemy.x, enemy.y)
                        self.enemies.remove(enemy)
                    else:
                        for _ in range(3):
                            self.particles.append(Particle(bullet.x, bullet.y, ORANGE))
                    self.bullets.remove(bullet)
                    break
                    
            # Collision avec le joueur
            if (self.player.x < enemy.x + enemy.width and
                self.player.x + self.player.width > enemy.x and
                self.player.y < enemy.y + enemy.height and
                self.player.y + self.player.height > enemy.y):
                if self.player.take_damage(50):
                    self.game_over()
                for _ in range(20):
                    self.particles.append(Particle(enemy.x, enemy.y, RED))
                self.enemies.remove(enemy)
                
            # Retirer les ennemis hors écran
            if enemy.y > HEIGHT:
                self.enemies.remove(enemy)
                
        # Mise à jour des balles ennemies
        for bullet in self.enemy_bullets[:]:
            bullet.update()
            
            # Collision avec le joueur
            if (self.player.x < bullet.x < self.player.x + self.player.width and
                self.player.y < bullet.y < self.player.y + self.player.height):
                if self.player.take_damage(bullet.damage):
                    self.game_over()
                self.enemy_bullets.remove(bullet)
            elif bullet.y > HEIGHT or bullet.x < 0 or bullet.x > WIDTH:
                self.enemy_bullets.remove(bullet)
                
        # Mise à jour des power-ups
        for power_up in self.power_ups[:]:
            power_up.update()
            
            # Collision avec le joueur
            if (self.player.x < power_up.x < self.player.x + self.player.width and
                self.player.y < power_up.y < self.player.y + self.player.height):
                if power_up.type == 'health':
                    self.player.health = min(self.player.max_health, self.player.health + 50)
                elif power_up.type == 'shield':
                    self.player.shield = self.player.max_shield
                elif power_up.type == 'weapon':
                    self.player.weapon_level = min(3, self.player.weapon_level + 1)
                elif power_up.type == 'rapid_fire':
                    self.player.rapid_fire = True
                    self.player.power_up_duration = 300
                    
                for _ in range(15):
                    self.particles.append(Particle(power_up.x, power_up.y, GREEN))
                self.power_ups.remove(power_up)
            elif power_up.y > HEIGHT:
                self.power_ups.remove(power_up)
                
        # Mise à jour des particules
        for particle in self.particles[:]:
            particle.update()
            if particle.lifetime <= 0:
                self.particles.remove(particle)
                
        # Augmenter la difficulté
        self.enemy_spawn_rate = max(20, 60 - self.player.level * 2)
        
    def game_over(self):
        self.game_state = 'game_over'
        if self.player.score > self.high_score:
            self.high_score = self.player.score
            self.save_high_score()
            
    def draw_menu(self):
        # Arrière-plan avec étoiles
        self.screen.fill(BLACK)
        for star in self.stars:
            star.update()
            star.draw(self.screen)
            
        # Titre avec effet de pulsation
        pulse = abs(math.sin(pygame.time.get_ticks() * 0.003)) * 10
        title = self.font_large.render("COSMIC DEFENDER", True, CYAN)
        title_rect = title.get_rect(center=(WIDTH // 2, 150 + pulse))
        
        # Ombre du titre
        shadow = self.font_large.render("COSMIC DEFENDER", True, BLUE)
        shadow_rect = shadow.get_rect(center=(WIDTH // 2 + 5, 155 + pulse))
        self.screen.blit(shadow, shadow_rect)
        self.screen.blit(title, title_rect)
        
        # Sous-titre
        subtitle = self.font_small.render("Défendez la galaxie contre l'invasion !", True, WHITE)
        subtitle_rect = subtitle.get_rect(center=(WIDTH // 2, 230))
        self.screen.blit(subtitle, subtitle_rect)
        
        # Instructions
        instructions = [
            "CONTRÔLES:",
            "ZQSD ou Flèches - Déplacer",
            "ESPACE - Tirer",
            "P - Pause",
            "ESC - Quitter",
            "",
            "OBJECTIF:",
            "Détruisez les ennemis et survivez !",
            "Récupérez les power-ups",
            "Affrontez les boss tous les 5 vagues",
        ]
        
        y_offset = 320
        for i, line in enumerate(instructions):
            if line == "CONTRÔLES:" or line == "OBJECTIF:":
                color = YELLOW
                font = self.font_small
            elif line == "":
                y_offset += 10
                continue
            else:
                color = WHITE
                font = self.font_tiny
                
            text = font.render(line, True, color)
            text_rect = text.get_rect(center=(WIDTH // 2, y_offset))
            self.screen.blit(text, text_rect)
            y_offset += 30 if line.startswith(("CONTRÔLES", "OBJECTIF")) else 25
            
        # High Score
        high_score_text = self.font_medium.render(f"MEILLEUR SCORE: {self.high_score}", True, ORANGE)
        high_score_rect = high_score_text.get_rect(center=(WIDTH // 2, HEIGHT - 120))
        self.screen.blit(high_score_text, high_score_rect)
        
        # Bouton Start avec animation
        start_alpha = int(200 + 55 * math.sin(pygame.time.get_ticks() * 0.005))
        start_text = self.font_medium.render("APPUYEZ SUR ESPACE POUR JOUER", True, GREEN)
        start_rect = start_text.get_rect(center=(WIDTH // 2, HEIGHT - 60))
        self.screen.blit(start_text, start_rect)
        
    def draw_hud(self):
        # Barre de vie
        health_ratio = self.player.health / self.player.max_health
        health_bar_width = 200
        health_bar_height = 20
        pygame.draw.rect(self.screen, RED, (20, 20, health_bar_width, health_bar_height))
        pygame.draw.rect(self.screen, GREEN, (20, 20, health_bar_width * health_ratio, health_bar_height))
        pygame.draw.rect(self.screen, WHITE, (20, 20, health_bar_width, health_bar_height), 2)
        
        health_text = self.font_tiny.render(f"VIE: {int(self.player.health)}/{self.player.max_health}", True, WHITE)
        self.screen.blit(health_text, (25, 23))
        
        # Barre de bouclier
        if self.player.max_shield > 0:
            shield_ratio = self.player.shield / self.player.max_shield
            shield_bar_width = 200
            shield_bar_height = 15
            pygame.draw.rect(self.screen, (50, 50, 100), (20, 45, shield_bar_width, shield_bar_height))
            pygame.draw.rect(self.screen, CYAN, (20, 45, shield_bar_width * shield_ratio, shield_bar_height))
            pygame.draw.rect(self.screen, WHITE, (20, 45, shield_bar_width, shield_bar_height), 2)
            
            shield_text = self.font_tiny.render(f"BOUCLIER: {int(self.player.shield)}", True, WHITE)
            self.screen.blit(shield_text, (25, 47))
        
        # Score
        score_text = self.font_medium.render(f"SCORE: {self.player.score}", True, YELLOW)
        self.screen.blit(score_text, (20, 80))
        
        # Niveau
        level_text = self.font_small.render(f"NIVEAU: {self.player.level}", True, PURPLE)
        self.screen.blit(level_text, (20, 130))
        
        # Barre d'expérience
        exp_ratio = self.player.experience / (self.player.level * 100)
        exp_bar_width = 200
        exp_bar_height = 10
        pygame.draw.rect(self.screen, (50, 50, 50), (20, 165, exp_bar_width, exp_bar_height))
        pygame.draw.rect(self.screen, PURPLE, (20, 165, exp_bar_width * exp_ratio, exp_bar_height))
        pygame.draw.rect(self.screen, WHITE, (20, 165, exp_bar_width, exp_bar_height), 2)
        
        # Vies
        lives_text = self.font_small.render(f"VIES: {'❤️ ' * self.player.lives}", True, RED)
        self.screen.blit(lives_text, (20, 185))
        
        # Niveau d'arme
        weapon_text = self.font_small.render(f"ARME LVL: {self.player.weapon_level}", True, CYAN)
        self.screen.blit(weapon_text, (WIDTH - 220, 20))
        
        # Vague
        wave_text = self.font_small.render(f"VAGUE: {self.wave}", True, ORANGE)
        self.screen.blit(wave_text, (WIDTH - 220, 60))
        
        # Power-up actif
        if self.player.rapid_fire:
            rapid_text = self.font_tiny.render(f"TIR RAPIDE: {self.player.power_up_duration // 60}s", True, ORANGE)
            self.screen.blit(rapid_text, (WIDTH - 220, 100))
            
        # Indicateur Boss
        if self.boss:
            boss_text = self.font_medium.render("⚠️ BOSS ⚠️", True, RED)
            boss_rect = boss_text.get_rect(center=(WIDTH // 2, 80))
            self.screen.blit(boss_text, boss_rect)
            
    def draw_game(self):
        # Arrière-plan
        self.screen.fill(BLACK)
        
        # Étoiles
        for star in self.stars:
            star.draw(self.screen)
            
        # Particules
        for particle in self.particles:
            particle.draw(self.screen)
            
        # Power-ups
        for power_up in self.power_ups:
            power_up.draw(self.screen)
            
        # Ennemis
        for enemy in self.enemies:
            enemy.draw(self.screen)
            
        # Boss
        if self.boss:
            self.boss.draw(self.screen)
            
        # Balles ennemies
        for bullet in self.enemy_bullets:
            bullet.draw(self.screen)
            
        # Balles du joueur
        for bullet in self.bullets:
            bullet.draw(self.screen)
            
        # Joueur
        self.player.draw(self.screen)
        
        # HUD
        self.draw_hud()
        
    def draw_pause(self):
        # Assombrir l'écran
        overlay = pygame.Surface((WIDTH, HEIGHT))
        overlay.set_alpha(200)
        overlay.fill(BLACK)
        self.screen.blit(overlay, (0, 0))
        
        # Texte Pause
        pause_text = self.font_large.render("PAUSE", True, YELLOW)
        pause_rect = pause_text.get_rect(center=(WIDTH // 2, HEIGHT // 2 - 50))
        self.screen.blit(pause_text, pause_rect)
        
        # Instructions
        resume_text = self.font_small.render("P ou ESC - Reprendre", True, WHITE)
        resume_rect = resume_text.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 30))
        self.screen.blit(resume_text, resume_rect)
        
        menu_text = self.font_small.render("M - Menu Principal", True, WHITE)
        menu_rect = menu_text.get_rect(center=(WIDTH // 2, HEIGHT // 2 + 70))
        self.screen.blit(menu_text, menu_rect)
        
    def draw_game_over(self):
        # Arrière-plan avec étoiles
        self.screen.fill(BLACK)
        for star in self.stars:
            star.update()
            star.draw(self.screen)
            
        # Titre Game Over
        game_over_text = self.font_large.render("GAME OVER", True, RED)
        game_over_rect = game_over_text.get_rect(center=(WIDTH // 2, 150))
        
        # Ombre
        shadow = self.font_large.render("GAME OVER", True, (100, 0, 0))
        shadow_rect = shadow.get_rect(center=(WIDTH // 2 + 5, 155))
        self.screen.blit(shadow, shadow_rect)
        self.screen.blit(game_over_text, game_over_rect)
        
        # Statistiques
        stats = [
            f"SCORE FINAL: {self.player.score}",
            f"NIVEAU ATTEINT: {self.player.level}",
            f"VAGUE: {self.wave}",
            f"ENNEMIS VAINCUS: {self.player.score // 10}",
        ]
        
        y_offset = 280
        for stat in stats:
            text = self.font_small.render(stat, True, WHITE)
            text_rect = text.get_rect(center=(WIDTH // 2, y_offset))
            self.screen.blit(text, text_rect)
            y_offset += 50
            
        # Nouveau record
        if self.player.score == self.high_score and self.player.score > 0:
            pulse = abs(math.sin(pygame.time.get_ticks() * 0.005)) * 10
            record_text = self.font_medium.render("🏆 NOUVEAU RECORD ! 🏆", True, YELLOW)
            record_rect = record_text.get_rect(center=(WIDTH // 2, y_offset + pulse))
            self.screen.blit(record_text, record_rect)
            y_offset += 80
        else:
            high_score_text = self.font_small.render(f"MEILLEUR SCORE: {self.high_score}", True, ORANGE)
            high_score_rect = high_score_text.get_rect(center=(WIDTH // 2, y_offset))
            self.screen.blit(high_score_text, high_score_rect)
            y_offset += 60
            
        # Boutons
        retry_alpha = int(200 + 55 * math.sin(pygame.time.get_ticks() * 0.005))
        retry_text = self.font_small.render("ESPACE - Rejouer", True, GREEN)
        retry_rect = retry_text.get_rect(center=(WIDTH // 2, y_offset))
        self.screen.blit(retry_text, retry_rect)
        
        menu_text = self.font_small.render("M - Menu Principal", True, WHITE)
        menu_rect = menu_text.get_rect(center=(WIDTH // 2, y_offset + 40))
        self.screen.blit(menu_text, menu_rect)
        
    def draw(self):
        if self.game_state == 'menu':
            self.draw_menu()
        elif self.game_state == 'playing':
            self.draw_game()
        elif self.game_state == 'paused':
            self.draw_game()
            self.draw_pause()
        elif self.game_state == 'game_over':
            self.draw_game_over()
            
        pygame.display.flip()
        
    def run(self):
        while self.running:
            self.clock.tick(FPS)
            self.handle_events()
            self.update()
            self.draw()
            
        pygame.quit()

if __name__ == "__main__":
    game = Game()
    game.run()